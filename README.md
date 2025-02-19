Go Implementation of [Vulnhuntr](https://github.com/protectai/vulnhuntr/tree/main?tab=readme-ov-file) using TypeScript  
A tool to find vulnerabilities using LLM and static code analysis.

![vulnhuntr-go-image](https://vulnhuntr.s3.us-west-1.amazonaws.com/vulnhuntr_title.png)

# Description
Although coding using LLM is growing rapidly recently such as Github copilot or Cursor or Cline, in the aspect of security few cases are overcoming human's ability.  
For example ChatGPT's o3-mini only complete 21% of college and professional level of CTF challenges(see [openAI's document](https://cdn.openai.com/o3-mini-system-card-feb10.pdf)).  
However this is not the limitation of LLM for security.  
  
In 2024/10/19, Protect AI a cyber security company, revealed "[Vulnhuntr: Autonomous AI Finds First 0-Day Vulnerabilities in Wild](https://protectai.com/threat-research/vulnhuntr-first-0-day-vulnerabilities)". This POC exploited python applications that received thousands of stars in Github for number of 13 of exploitations.  
Autonomous security detection is suffered from "false positives in static code analysis" and "lack of context information in LLM", However surprisingly Vulnhuntr overcame These two flaws, by combining both static code analysis and LLM.  
  
However this POC is implemented using only in python.  
Therefore I decided to port this project aiming for Go language using TypeScript.  
  
> [!CAUTION]
> This project is still work in progress and is assessing and evaluating.  
> We only support `chi` and `http`  
> Please use as educational or security research purposes only.  

# Features

- Search Code Definition using gopls (We only support `chi` and `http` now ...)
- Pick possibly vulnerable codes using LLM(Claude)
- Output report result as JSON

# How to start?
  
1. Please install go and node by yourself
2. Install gopls
```
brew install go
brew install gopls
```
3. Clone the project
```
git clone https://github.com/YmBIgo/vulnhuntr-go.git
```
4. Set API_KEY
```
export CLAUDE_API_KEY=your-api-key
```
5. Decide which file paths to output / search  
 `outputPath` for folder which you want report json to be outputted.  
 `rootFile` for file which define routing.  
 `rootPath` for folder which is root of your go project  
6. Run the project
```
npm run start -- -- <outputPath> <rootFile> <rootPath>
```