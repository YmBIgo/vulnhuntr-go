import fs from "fs/promises"
import { exec } from "child_process"
import util from "util"

// promisify exec
const promisifyExec = util.promisify(exec)

// get symbol position in specified file
async function getSymbolPosition(filePath: string, funcName: string, funcBeforeWords: string): Promise<[number, number]> {
    let fileContent
    try {
        fileContent = (await fs.readFile(filePath)).toString()
    } catch (e) {
        console.warn(e)
        return [0, 0]
    }
    const fileContentSplit = fileContent.split("\n")
    const regexpString = `${funcBeforeWords}${funcName}`.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
    const re = new RegExp(regexpString, "g")
    let match: RegExpExecArray | null = null
    let rowNumber = 1
    for(let row of fileContentSplit) {
        if (match = re.exec(row)) {
            return [rowNumber, match.index + funcBeforeWords.length + 1]
        }
        rowNumber += 1
    }
    return [0, 0] // this should not happen
}

async function getFileContent(filePath: string, startRow: number) {
    let originalFileContent
    try {
        originalFileContent = (await fs.readFile(filePath)).toString()
    } catch (e) {
        console.warn(e)
        return ""
    }
    const fileContentSplit = originalFileContent.split("\n")
    const fileContent = fileContentSplit.slice(startRow - 1)
    let fileResultArray = []
    let startArrowCount = 0
    let endArrowCount = 0
    for(let row of fileContent){
        fileResultArray.push(row)
        startArrowCount += row.match(/\{/g)?.length ?? 0
        endArrowCount += row.match(/\}/g)?.length ?? 0
        if (startArrowCount === endArrowCount && startArrowCount + endArrowCount !== 0) {
            return fileResultArray.join("\n")
        }
    }
}

// < example entrypoint >
// filePath : `/Users/coffeecup/Documents/work/65diary/backend`
// funcName : `route.PromptRoute`
// funcBeforeWords : `r.Mount("/prompts", `

// run gopls process to get implementation of specified function.
export class SymbolExtractor {
    private ignoreFolder = ["/test/", "/tests/", "_test/", "/docs/", "/doc/", "/example/", "/examples/"]
    private filePath = "./main.go"
    private funcName = ""
    private funcBeforeWords = ""
    private rootPath = ""
    private fileRow = 0
    private filePos = 0
    private goplsPath = "gopls"
    constructor(rootPath: string, filePath: string, funcName: string, funcBeforeWords: string) {
        // use getSymbolPosition function to get filePath and filePos
        this.rootPath = rootPath
        this.filePath = filePath
        this.funcName = funcName
        this.funcBeforeWords = funcBeforeWords
    }
    async init(): Promise<void> {
        const [matchRow, matchIndex] = await getSymbolPosition(this.filePath, this.funcName, this.funcBeforeWords)
        this.fileRow = matchRow
        this.filePos = matchIndex
    }
    async searchFile(): Promise<string[]> {
        if (this.filePos === 0 && this.fileRow === 0){
            console.warn("file pos not found...")
            return ["", ""]
        }
        const findReferencesCommand = `cd ${this.rootPath};
${this.goplsPath} definition ${this.filePath}:${this.fileRow}:${this.filePos}`
        // console.log(findReferencesCommand)
        let stdout, stderr;
        try {
            const std = await promisifyExec(findReferencesCommand)
            stdout = std.stdout
            stderr = std.stderr
        } catch(e) {
            console.warn(e)
            return ["", ""]
        }
        if (stderr) {
            console.warn("error occurs : " + stderr)
        }
        const stdoutFilePath = stdout?.split(": defined here")[0] ?? ""
        if (this.ignoreFolder.find((p) => stdoutFilePath.includes(p) )) {
            console.warn("file path contains ignore content")
            return ["", ""]
        }
        const [filePath, fileContent] = await this.parseStdoutFilePath(stdoutFilePath)
        return [filePath, fileContent]
    }
    async parseStdoutFilePath(filePath: string): Promise<string[]> {
        const splitFilePath = filePath.split("/")
        const fileInfo = splitFilePath[splitFilePath.length - 1]
        const fileName = fileInfo.split(":")[0]
        const resultFilePath = [...splitFilePath.slice(0, splitFilePath.length - 1), fileName].join("/")
        const fileRow = Number(fileInfo.split(":")[1])
        const fileContent = await getFileContent(resultFilePath, fileRow)
        return [resultFilePath, fileContent ?? ""]
    }
    reConstructor(rootPath: string, filePath: string, funcName: string, funcBeforeWords: string) {
        this.rootPath = rootPath
        this.filePath = filePath
        this.funcName = funcName
        this.funcBeforeWords = funcBeforeWords
    }
}