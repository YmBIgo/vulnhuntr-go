import { SymbolExtractor } from "./goplsSymbolExtractor";
import { RootFinder } from "./rootFinder";

async function testSearchFile() {
  const symbolExtractor = new SymbolExtractor(
    `/Users/coffeecup/Documents/work/65diary/backend/`,
    `/Users/coffeecup/Documents/work/65diary/backend/router/route/prompt_route.go`,
    // `PromptRoute`,
    `CreatePrompt`,
    // `r.Mount("/prompts", route.`
    `r.Post("/create", handler.`
  );
  await symbolExtractor.init();
  await symbolExtractor.searchFile();
}

async function testRootFinder() {
    const rootFinder = new RootFinder(
        `/Users/coffeecup/Documents/work/65diary/backend/`,
        // `/Users/coffeecup/Documents/work/65diary/backend/application.go`
        `/Users/coffeecup/Documents/work/65diary/backend/router/route/userAuth_route.go`
    )
    await rootFinder.execRegex()
    await rootFinder.execSearch()
}

// testSearchFile();
testRootFinder()