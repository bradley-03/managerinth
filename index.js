import { input, select, Separator, confirm } from "@inquirer/prompts"
import inquirer from 'inquirer'
import chalk from 'chalk';
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

//        _   _ _ 
//       | | (_) |
//  _   _| |_ _| |
// | | | | __| | |
// | |_| | |_| | |
//  \__,_|\__|_|_|          
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

function deleteList(id) {
    const currentLists = config.get('modLists')
    const updatedList = currentLists.filter((list) => list.id !== id)

    config.set('modLists', updatedList)
}

//  _ __ ___   ___ _  __ _   _ ___ 
// | '_ ` _ \ / _ \ '_ \| | | / __|
// | | | | | |  __/ | | | |_| \__ \
// |_| |_| |_|\___|_| |_|\__,_|___/ 
// Menus
                                
async function mainMenu() {
    const selection = await select({
        message: chalk.italic("What would you like to do?"),
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
        message: chalk.italic("Which option would you like to change?"),
        choices: [
            {
                name: `Downloads Path: ${chalk.bold.green(config.get('downloadPath'))}`,
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

//  _ _     _       
// | (_)   | |      
// | |_ ___| |_ ___ 
// | | / __| __/ __|
// | | \__ \ |_\__ \
// |_|_|___/\__|___/
// Lists

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
            description: chalk.gray(`| ${modList.name} | ${modList.mods} mods |`)
        })
    } // make them look nice for selection

    const choices = [
        ...modListsOptions,
        new Separator(),
        {
            name: chalk.italic('Create List'),
            value: 'create'
        },
        new Separator(),
        {
            name: chalk.italic('Return'),
            value: 'return'
        },
        new Separator()
    ] // merge list options with static options

    const selection = await select({
        message: chalk.italic("Your Mod Lists"),
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
        message: chalk.italic(`${foundList.name}`),
        choices: [
            new Separator(),
            {
                name: 'Edit Mods',
                value: 'editmods'
            },
            {
                name: chalk.red('Delete List'),
                value: 'delete'
            },
            new Separator(),
            {
                name: 'Return',
                value: 'return'
            },
        ],
    }, { clearPromptOnDone: true })

    if (selection == "delete") {
        const confirmation = await confirm({
            message: `Are you sure you want to delete ${chalk.green.bold(foundList.name)}?`
        }, { clearPromptOnDone: true })

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