import {select} from "@inquirer/prompts"
import "colors"
import Conf from 'conf'
import fs from "fs/promises"

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const config = new Conf({
    projectName: "modrinth-manage",
    defaults: {
        downloadPath: path.join(__dirname, 'downloads')
    }
})

async function mainMenu () {
    const selection = await select({
        message: "What would you like to do?".italic,
        choices: [
            {
                name: 'Your Mod Lists',
                value: 'lists',
            },
            {
                name: 'Download Mods',
                value: 'download',
            },
            {
                name: 'Options',
                value: 'options'
            }
        ],
    }, {clearPromptOnDone: true})

    if (selection == "options") {
        await optionsMenu()
    }

}

async function optionsMenu () {
    const selection = await select({
        message: "Which option would you like to change?".italic,
        choices: [
            {
                name: 'Return',
                value: 'return'
            }
        ]
    }, {clearPromptOnDone: true})

    if (selection == 'return') {
        await mainMenu()
    }
}

async function main () {
    console.clear()

    // Download path handling
    try {
        await fs.opendir(config.get('downloadPath'))
    } catch (e) {
        console.log("Directory Doesn't Exist")
    }

    // Main Menu
    await mainMenu()
}

main()