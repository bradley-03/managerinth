import { input, select, Separator, confirm } from "@inquirer/prompts"
import inquirer from 'inquirer'
import "colors"
import Conf from 'conf'
import fs from "fs/promises"
import os from "os"
import { nanoid } from "nanoid"

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Directory from "inquirer-directory"
inquirer.registerPrompt('directory', Directory);

const config = new Conf({
    projectName: "modrinth-manage",
    defaults: {
        downloadPath: path.join(__dirname, 'downloads'),
        modLists: []
    }
})


// Util
async function validateListName(name) {
    if (name.trim() === "") {
        return 'List name cannot be empty.'
    }
    if (name.length > 24) {
        return 'List name cannot exceed 24 characters.'
    }

    const lists = config.get('modLists')

    for (let list of lists) {
        if (list.name == name) {
            return `A list with the name '${name}' already exists.`
        }
    }
    return true
}

function deleteList (id) {
    const currentLists = config.get('modLists')
    const updatedList = currentLists.filter((list) => list.id !== id)

    config.set('modLists', updatedList)
}


// Menus
async function mainMenu() {
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
        return await listsMenu()
    }

    if (selection == "options") {
        return await optionsMenu()
    }

}

async function optionsMenu() {
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
        }, { clearPromptOnDone: true })
        if (newPath == "c") {
            return await optionsMenu()
        } else {
            config.set('downloadPath', newPath)
            return await optionsMenu()
        }
    }

    if (selection == 'return') {
        return await mainMenu()
    }
}

// LISTS MENUS
async function listsMenu() {
    const modLists = config.get('modLists')

    const modListsOptions = []
    if (modLists.length == 0) {
        modListsOptions.push({
            name: ' ',
            disabled: 'No lists found!'
        })
    }
    for (let modList of modLists) {
        modListsOptions.push({
            name: modList.name,
            value: `list-${modList.id}`,
            description: `| ${modList.name} | ${modList.mods} mods |`.gray
        })
    } // make them look nice for selection

    const choices = [
        ...modListsOptions,
        new Separator(),
        {
            name: 'Create List'.italic,
            value: 'create'
        },
        new Separator(),
        {
            name: 'Return'.italic,
            value: 'return'
        },
        new Separator()
    ] // merge list options with static options

    const selection = await select({
        message: "Your Mod Lists".italic,
        choices: choices,
        pageSize: 11,
    }, { clearPromptOnDone: true })

    if (selection.includes('list-')) { // check if selected a list
        const listId = selection.substring(5, selection.length) // parse list id
        return await viewList(listId)
    }

    if (selection == "create") {
        return await createList()
    }

    if (selection == 'return') {
        return await mainMenu()
    }
}

async function createList() {
    const name = await input({
        message: "Enter a name for your new mod list:",
        validate: validateListName,
    }, { clearPromptOnDone: true })

    const currentLists = config.get('modLists')
    const newList = {
        id: nanoid(),
        name: name.trim(),
        mods: 0,
    }
    config.set('modLists', [...currentLists, newList])

    return await listsMenu()
}

async function viewList(list) {
    const modLists = config.get('modLists')
    const foundList = modLists.filter((modList) => modList.id == list)[0]

    const selection = await select({
        message: `${foundList.name}`.italic,
        choices: [
            {
                name: 'Edit Mods',
                value: 'editmods'
            },
            {
                name: 'Delete List'.red,
                value: 'delete'
            },
            {
                name: 'Return',
                value: 'return'
            },
        ],
    }, { clearPromptOnDone: true })

    if (selection == "delete") {
        
        const confirmation = await confirm({
            message: `Are you sure you want to delete ${foundList.name.brightGreen}?`
        }, {clearPromptOnDone: true})

        if (confirmation == true) {
            deleteList(foundList.id)
            return await listsMenu()
        } else {
            return await (viewList(foundList.id))
        }
    }

    return await listsMenu()
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