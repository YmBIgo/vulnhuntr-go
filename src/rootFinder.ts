import fs from "fs/promises"
import { SymbolExtractor } from "./goplsSymbolExtractor";

type SearchFileType = {
    rootPath: string;
    filePath: string;
    funcName: string;
    funcBeforeWords: string;
}

export class RootFinder {
    private rootPath = ""
    private filePath = ""
    private patterns: RegExp[] = []
    private multiLinePatterns: RegExp[] = []
    private matchedSearchFileArray: SearchFileType[] = []
    constructor(rootPath: string, filePath: string) {
        this.rootPath = rootPath
        this.filePath = filePath
        this.initRegex()
    }
    initRegex() {
        const patterns = [
            // chi 1行の関数の場合 ()
            /Use\(([a-zA-Z0-9.]+(\([a-zA-Z0-9.]+\))*)\)/g,
            /Mount\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Handle\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /HandleFunc\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Connect\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Delete\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Get\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Head\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Options\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Patch\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Post\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Put\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /Trace\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            /NotFound\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\(([a-zA-Z0-9.]+)\)\s*\)/g,
            // http 1行の関数の場合
            /Mount\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Handle\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /HandleFunc\(\s*"[a-zA-Z0-9\/_-\{\}#]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Connect\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Delete\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Get\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Head\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Options\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Patch\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Post\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Put\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /Trace\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
            /NotFound\(\s*"[a-zA-Z0-9\/_-\{\}]+"\s*,\s*([a-zA-Z0-9.]+)\s*\)/g,
        ]
            // chi 複数行の関数の場合 {}
        const multiLinePatterns = [
            /Mount\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Handle\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /HandleFunc\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Connect\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Delete\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Get\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Head\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Options\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Patch\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Put\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /Trace\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
            /NotFound\(\s*"[a-zA-Z0-9\/]+",\s*(func[\s\S]*?\{[\s\S]*?\})\s*\)/g,
        ]
        this.patterns = patterns
        this.multiLinePatterns = multiLinePatterns
    }
    async getRootFileContent() {
        const fileContent = (await fs.readFile(this.filePath)).toString()
        return fileContent
    }
    async execRegex() {
        const fileContent = (await fs.readFile(this.filePath)).toString()
        const searchFileArray: SearchFileType[] = []
        const cacheResult: string[] = []
        this.patterns.forEach((p) => {
            let matchResult: RegExpExecArray | null
            while(matchResult = p.exec(fileContent)){
                const beforeWords = matchResult[0].split(matchResult[1])[0]
                if (matchResult[1]) {
                    const lastFuncNameArray = matchResult[1].split(".")
                    const lastFuncName = lastFuncNameArray[lastFuncNameArray.length - 1]
                    const notLastFuncName = lastFuncNameArray.slice(0, -1)
                    if (cacheResult.find((r) => r === lastFuncName)) continue
                    const searchFileContent = {
                        rootPath: this.rootPath,
                        filePath: this.filePath,
                        funcName: lastFuncName,
                        funcBeforeWords: beforeWords + notLastFuncName.join(".") + (lastFuncNameArray.length > 1 ? "." : "")
                    }
                    searchFileArray.push(searchFileContent)
                    cacheResult.push(lastFuncName)
                }
                if (matchResult[2] && !cacheResult.find((r) => r === matchResult?.[2])) {
                    const searchFileContent = {
                        rootPath: this.rootPath,
                        filePath: this.filePath,
                        funcName: matchResult[2],
                        funcBeforeWords: beforeWords + matchResult[1]
                    }
                    searchFileArray.push(searchFileContent)
                    cacheResult.push(matchResult[2])
                }
            }
        })
        this.matchedSearchFileArray = searchFileArray
    }
    async execSearch() {
        let result1: string[][] = []
        const promises = this.matchedSearchFileArray.map(async(result) => {
            const symbolExtractor = new SymbolExtractor(
                result.rootPath,
                result.filePath,
                result.funcName,
                result.funcBeforeWords
            )
            await symbolExtractor.init()
            const eachResult = await symbolExtractor.searchFile()
            result1.push(eachResult)
        })
        await Promise.all(promises)
        return result1
    }
}