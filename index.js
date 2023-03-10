const fs = require("fs");
const { JSDOM } = require("jsdom");
const { serializeToString } = require("xmlserializer");
const { chromium } = require("playwright");

const inputHtml = fs.readFileSync("docs-copy/index.html", "utf8");
const dom = new JSDOM(inputHtml);

let count = 1;

let browser, context, page;

async function launchBrowser() {
    browser = await chromium.launch({
        headless: true,
        slowMo: 200,
    });

    context = await browser.newContext({
        viewport: null,
        permissions: ["clipboard-read", "clipboard-write"],
    });

    page = await context.newPage();
    await page.goto("https://translate.google.com/");
}

async function translateText(arg_text) {
    try {
        if (!browser) {
            await launchBrowser();
        } else {
            await page.goto("https://translate.google.com/");
        }
        await page.getByRole("combobox", { name: "Source text" }).click();
        await page.getByRole("combobox", { name: "Source text" }).fill(arg_text);
        await page
            .getByRole("button", { name: "More target languages" })
            .click({ timeout: 30000, force: true });
        await page
            .getByRole("main", { name: "Text translation" })
            .getByText("Hindi")
            .nth(1)
            .click({ force: true });

        await page.getByRole("button", { name: "Copy translation" }).click();
        const text = await page.evaluate("navigator.clipboard.readText()");
        return text;
    } catch (error) {
        console.log(
            "\x1b[93m [WARNING] \x1b[39m An error occured. Reason: ",
            error
        );
        throw error;
    }
}

async function translateElement(element) {
    const text = element.textContent.trim();
    if (text) {
        console.log(`\x1b[92m [${count++}]\x1b[96m Translating: ${text} \x1b[39m`);
        const new_text = await translateText(text);
        element.textContext = new_text;
        console.log("\x1b[95m Translated: " + new_text, "\x1b[39m");
    }
}

async function translateElements(elements) {
    for (const element of elements) {
        if (element.nodeType === dom.window.Node.TEXT_NODE) {
            await translateElement(element);
        } else if (element.childNodes.length > 0) {
            await translateElements(element.childNodes);
        } else {
            await translateElement(element);
        }
    }
}

const bodyElements = Array.from(
    dom.window.document.body.querySelectorAll("*")
).filter(
    (element) =>
        !["script", "noscript", "style", "link"].includes(
            element.tagName.toLowerCase()
        )
);

translateElements(bodyElements)
    .then((r) => console.log(r))
    .finally(async () => {
        await context.close();
        await browser.close();
    });

const outputHtml = serializeToString(dom.window.document);
fs.writeFileSync("docs-copy/index-translate.html", outputHtml, "utf8");