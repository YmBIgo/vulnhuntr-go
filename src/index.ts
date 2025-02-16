import xmlbuilder from "xmlbuilder"
import { RootFinder } from "./rootFinder";
import {
    INITIAL_ANALYSIS_PROMPT_TEMPLATE,
    ANALYSIS_APPROACH_TEMPLATE,
    RESPONSE_FORMAT,
    VULN_SPECIFIC_BYPASSES_AND_PROMPTS
} from "./prompts"
import { LLM } from "./api";
import { SymbolExtractor } from "./goplsSymbolExtractor";
import fs from "fs/promises"
import crypto from "crypto"

type AnalysisResult = {
    scratchpad: string;
    analysis: string;
    poc: string;
    confidence_score: number;
    vulnerability_types: ("LFI" | "RCE" | "SSRF" | "AFO" | "SQLI" | "XSS" | "IDOR")[];
    context_code: {name: string; reason: string; code_line: string;}[];
}

function parseJsonRes(data: any): AnalysisResult {
    return {
        scratchpad: String(data.scratchpad),
        analysis: String(data.analysis),
        poc: String(data.poc),
        confidence_score: isNaN(Number(data.confidence_score)) ? 0 : Number(data.confidence_score),
        vulnerability_types: data.vulnerability_types.map((d: string) => String(d)),
        context_code: data.context_code.map((d: any) => {
            return { name: String(d.name), reason: String(d.reason), code_line: String(d.code_line) }
        })
    }
}

function generateXml(fileContent: string, filePath: string, prevContext: string, definitions?: string[], example_bypasses?: string) {
    const root = xmlbuilder.create("root")
    const fileCode = root.ele("file_code")
    fileCode.att("file_source", fileContent)
    fileCode.att("file_path", filePath)
    if (definitions?.length) {
        const definition = root.ele("context_code")
        definition.att("definitions", definitions)
    }
    if (example_bypasses) {
        const example_bypasses = root.ele("example_bypasses")
        example_bypasses.att("example_bypasses", example_bypasses)
    }
    const instructions = root.ele("instructions")
    instructions.att("instructions", INITIAL_ANALYSIS_PROMPT_TEMPLATE)
    const analysisApproach = root.ele("analysis_approach")
    analysisApproach.att("analysis_approach", ANALYSIS_APPROACH_TEMPLATE)
    const prevAnalysis = root.ele("previousAnalysis")
    prevAnalysis.att("previous_analysis", prevContext)
    const responseFormat = root.ele("responseFormat")
    responseFormat.att("responseFormat", JSON.stringify(RESPONSE_FORMAT))
    const xml = root.end({pretty: true})
    return xml
}

function addContext(context: {[key: string]: string[]}, filePath: string, fileContent: string){
    const filePathInContext = context[filePath]
    if (filePathInContext && filePathInContext.length) {
        const newContext = {...context, [filePath]: [...filePathInContext, fileContent]}
        return newContext
    }
    const newContext = {...context, [filePath]: [fileContent]}
    return newContext
}

function generateUuid() {
    return crypto.randomUUID()
}

async function main() {
    // const outputPath = "/Users/coffeecup/Desktop/Codes/vulnhuntr-go/note-go"
    // const rootFile = "/Users/coffeecup/Documents/programming/Go/chinesenotes-go/cnweb.go"
    // const rootPath = "/Users/coffeecup/Documents/programming/Go/chinesenotes-go"
    const outputPath = "/Users/coffeecup/Desktop/Codes/vulnhuntr-go/65diary"
    const rootFile = "/Users/coffeecup/Documents/work/65diary/backend/application.go"
    const rootPath = "/Users/coffeecup/Documents/work/65diary/backend"
    const rootFinder = new RootFinder(rootPath, rootFile)
    const rootFileContent = await rootFinder.getRootFileContent()
    await rootFinder.execRegex()
    const result = (await rootFinder.execSearch()).filter((r) => r[0] && r[1])
    const symbolExtractor = new SymbolExtractor(
        `/Users/coffeecup/Documents/work/65diary/backend/`,
        `/Users/coffeecup/Documents/work/65diary/backend/router/route/prompt_route.go`,
        ``,
        ``
    )
    for (let ii in result) {
        const [filePath, fileContent] = result[ii]
        let fileContext = { [rootFile]: [rootFileContent] }
        const fixedFilePath = filePath.replace(rootPath, "")
        const xml = generateXml(fileContent, fixedFilePath, "")
        const llm = new LLM("")
        let firstReportJson = {} as AnalysisResult
        try {
            console.log("sleeping 15 seconds ...")
            await new Promise((resolve) => setTimeout(resolve, 15000))
            const res = await llm.chat(xml)
            firstReportJson = parseJsonRes(JSON.parse(res))
            console.log(">>>> first iteration ... ", rootFile)
        } catch (e) {
            console.error(e)
            return
        }
        addContext(fileContext, filePath, fileContent)
        const vulnerabilities = firstReportJson.vulnerability_types
        if (firstReportJson.confidence_score > 0 && vulnerabilities.length) {
            for ( let vul of vulnerabilities ) {
                let prevAnalysis = firstReportJson.analysis
                let secondReportJson = {} as AnalysisResult
                let storedCodeDefinition = {} as {[key: string]: string}
                let codeDefinitions: string[] = []
                let currentFile = filePath
                let prevCurrentFiles: string[] = [filePath]
                for (let i = 0; i < 10; i++) {
                    if (i === 0) {
                        for (let ctx of firstReportJson.context_code) {
                            if (!Object.keys(storedCodeDefinition).includes(ctx.name)) {
                                const splitCtxName = ctx.name.split(".")
                                const lastCtxName = splitCtxName[splitCtxName.length - 1]
                                const beforeWords = ctx.code_line.split(lastCtxName)[0]
                                symbolExtractor.reConstructor(rootPath, filePath, lastCtxName, beforeWords)
                                await symbolExtractor.init()
                                const matchResult = await symbolExtractor.searchFile()
                                prevCurrentFiles.push(matchResult[0])
                                if (matchResult[0] !== "" && matchResult[1] !== "") {
                                    storedCodeDefinition[ctx.name] = matchResult[1]
                                }
                            }
                        }
                        prevCurrentFiles = [...new Set(prevCurrentFiles)]
                        codeDefinitions = Object.values(storedCodeDefinition)
                    } else {
                    // 2回目以降は、secondReportJsonに値が入る
                        for (let ctx of secondReportJson.context_code) {
                            if (!Object.keys(storedCodeDefinition).includes(ctx.name)) {
                                const splitCtxName = ctx.name.split(".")
                                const lastCtxName = splitCtxName[splitCtxName.length - 1]
                                const beforeWords = ctx.code_line.split(lastCtxName)[0]
                                console.log("searching ... ", ctx.name, lastCtxName, beforeWords)
                                let matchResult: string[] = []
                                // 前回のファイル情報を保持できないので、すべてのファイルを検索している
                                for (let i in prevCurrentFiles.reverse()) {
                                    const fileP = prevCurrentFiles[i]
                                    symbolExtractor.reConstructor(rootPath, fileP, lastCtxName, beforeWords)
                                    await symbolExtractor.init()
                                    matchResult = await symbolExtractor.searchFile()
                                    if (matchResult[0] !== "" && matchResult[1] !== "") {
                                        console.log("found for ... ", matchResult[0])
                                        prevCurrentFiles.push(matchResult[0])
                                        break
                                    } else if (Number(i) === prevCurrentFiles.length - 1) {
                                        console.log("not found for ... ", beforeWords, lastCtxName, prevCurrentFiles)
                                    }
                                }
                                if (matchResult[0] !== "" && matchResult[1] !== "") {
                                    storedCodeDefinition[ctx.name] = matchResult[1]
                                }
                            }
                        }
                        prevCurrentFiles = [...new Set(prevCurrentFiles)]
                        codeDefinitions = Object.values(storedCodeDefinition)
                    }
                    const vulnerabilitiesXml = generateXml(
                        fileContent,
                        fixedFilePath,
                        prevAnalysis,
                        codeDefinitions,
                        VULN_SPECIFIC_BYPASSES_AND_PROMPTS[vul].bypasses.join("\n")
                    )
                    try {
                        await new Promise((resolve) => setTimeout(resolve, 5000))
                        console.log("sleeping 5 seconds")
                        const res = await llm.chat(vulnerabilitiesXml)
                        secondReportJson = parseJsonRes(JSON.parse(res))
                        console.log(">>>> second report iteration ... ", i, currentFile)
                    } catch(e) {
                        console.error(e)
                        secondReportJson = {} as AnalysisResult
                    }
                    if (!secondReportJson.context_code || !secondReportJson.context_code.length) {
                        break
                    }
                }
                console.log(">>>> final second report : ", secondReportJson)
                const uuid = generateUuid()
                try {
                    fs.writeFile(`${outputPath}/${uuid}.json`, JSON.stringify(secondReportJson))
                } catch(e) {
                    console.log(e)
                }
                console.log("sleeping 30 seconds ...")
                await new Promise((resolve) => setTimeout(resolve, 30000))
                console.log("sleeping end !")
            }
        }
    }
}

main();
