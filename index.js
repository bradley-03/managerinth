import { input, select, Separator } from "@inquirer/prompts"
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
        downloadPath: path.join(__dirname, 'downloads'),
        modLists: []
    }
})

async function mainMenu () {
    const selection = await select({
        message: "What would you like to do?".italic,
        choices: [
            {
                name: 'Mod Lists',
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
    }, { clearPromptOnDone: true })

    if (selection == "lists") {
        await listsMenu()
    }

    if (selection == "options") {
        await optionsMenu()
    }

}

async function optionsMenu () {
    const selection = await select({
        message: "Which option would you like to change?".italic,
        choices: [
            {
                name: `Downloads Path: ${config.get('downloadPath').brightGreen.bold}`,
                value: 'downloadPath'
            },
            new Separator(),
            {
                name: 'Return',
                value: 'return'
            }
        ]
    }, { clearPromptOnDone: true })

    if (selection == "downloadPath") {
        const newPath = await input({
            message: 'Enter a new path where you want mods to be downloaded or type "c" to cancel:'
        }, {clearPromptOnDone: true})
        if (newPath == "c") {
            await optionsMenu()
        } else {
            config.set('downloadPath', newPath)
            await optionsMenu()
        }
    }

    if (selection == 'return') {
        await mainMenu()
    }
}

// LISTS MENUS
async function listsMenu () {
    const selection = await select({
        message: "Your Mod Lists".italic,
        choices: [
            {
                name: `Your Lists`,
                value: 'downloadPath'
            },
            new Separator(),
            {
                name: 'Create List',
                value: 'create'
            },
            new Separator(),
            {
                name: 'Return',
                value: 'return'
            }
        ]
    }, { clearPromptOnDone: true })

    if (selection == "create") {
        await createList()
    }

    if (selection == 'return') {
        await mainMenu()
    }
}

async function createList () {
    const name = await input({message: "Enter a name for your new mod list:"})

    const currentLists = config.get('modLists')
    const newList = {
        name
    }
    config.set('modLists', [...currentLists, newList])
    const currentLists2 = config.get('modLists')
    console.log(currentLists2)
}

async function main() {
    console.clear()

    // Download path handling
    // try {
    //     const dir = await fs.opendir(config.get('downloadPath'))
    // } catch (e) {

    // }

    // Main Menu
    await mainMenu()
}

main()