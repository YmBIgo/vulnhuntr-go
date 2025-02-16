import Anthropic from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";

const ANTHROPIC_API_KEY = process.env["CLAUDE_API_KEY"]

export class LLM {
    private systemPrompt = ""
    private history: MessageParam[] = []
    private prevPrompt = ""
    private prevResponse = ""
    private client = new Anthropic({
        apiKey: ANTHROPIC_API_KEY
    });
    private model = "claude-3-5-sonnet-20241022"
    private prefill = `{    "scratchpad": "1.`

    constructor(systemPrompt: string, model?: string) {
        this.systemPrompt = systemPrompt
        if (model) this.model = model
    }
    addHistory(role: "user" | "assistant", content: string) {
        this.history.push({
            role,
            content: [{
                type: "text",
                text: content
            }]
        })
    }
    logResponse(response: (Anthropic.Messages.Message & {
        _request_id?: string | null | undefined;
    }) | undefined) {
        if (!response) {
            console.warn("Received no data ...")
            return
        }
        const usageInfo = response.usage
        console.log("Received chat response", usageInfo.output_tokens)
    }
    createMessages(userPrompt: string): MessageParam[] {
        const messages: MessageParam[] = [
            {
                role: "user",
                content: [{
                    type: "text",
                    text: userPrompt
                }]
            },
            {
                role: "assistant",
                content: [{
                    type: "text",
                    text: this.prefill
                }]
            }
        ]
        return messages
    }
    async sendMessages(messages: MessageParam[]) {
        try {
            const message = await this.client.messages.create({
                model: this.model,
                max_tokens: 8192,
                system: this.systemPrompt,
                messages: messages
            })
            return message
        } catch(e) {
            console.error(e)
        }
    }
    getResponse(response:(Anthropic.Messages.Message & {
        _request_id?: string | null | undefined;
    }) | undefined) {
        if (!response) return ""
        const type = response.content[0].type
        if (type !== "text") return ""
        const text = response.content[0].text.replace(/\n/, "")
        return text
    }
    async chat(userPrompt: string) {
        this.addHistory("user", userPrompt)
        const messages = this.createMessages(userPrompt)
        const response = await this.sendMessages(messages)
        const responseText = this.prefill + this.getResponse(response)
        this.addHistory("assistant", responseText ?? "")
        return responseText ?? ""
    }
}