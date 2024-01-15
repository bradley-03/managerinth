import { input, select, Separator, confirm } from "@inquirer/prompts"
import inquirer from 'inquirer'
import chalk, { modifierNames } from 'chalk';
import Conf from 'conf'
import fs from "fs/promises"
import os from "os"
import { nanoid } from "nanoid"
import chalkAnimation from 'chalk-animation'
import ora from "ora"
import axios from "axios"

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import Directory from "inquirer-directory"
inquirer.registerPrompt('directory', Directory)

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

function updateList(listId, data) {
    const allLists = config.get('modLists')
    const reqListIndex = allLists.findIndex((list) => list.id == listId)
    allLists[reqListIndex] = data

    config.set('modLists', allLists)
}

function getList(listId) {
    const allLists = config.get('modLists')
    const foundList = allLists.filter((list) => list.id == listId)[0]
    return foundList
}

async function getModrinth(page, query) {
    const spinner = ora('Loading...').start()
    try {
        const res = await axios.get(`https://api.modrinth.com/v2/search?query="${query == null ? "" : query}"&limit=20&offset=${page * 20}`)
        spinner.stop()
        return res.data
    } catch (e) {
        spinner.fail('Something went wrong!')
        return await listsMenu()
    }
}

async function dataFromIds(ids) {
    const spinner = ora('Loading...').start()

    try {
        const res = await axios.get(`https://api.modrinth.com/v2/projects`, { params: { ids: JSON.stringify(ids) } })
        spinner.stop()
        return res.data
    } catch (e) {
        spinner.fail('Something went wrong!')
        console.log(e)
        return await listsMenu()
    }
}

function removeModsFromList (listId, mods) {
    
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
            description: chalk.dim(`| ${modList.name} | ${modList.modCount} mods |`)
        })
    } // make them look nice for selection

    const choices = [
        new Separator(),
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
        modCount: 0,
        mods: []
    }
    config.set('modLists', [...currentLists, newList])

    return await listsMenu()
}

async function viewList(list) {
    const foundList = getList(list)

    const selection = await select({
        message: `${chalk.italic(foundList.name)} | ${foundList.modCount} mods`,
        choices: [
            new Separator(),
            {
                name: 'View Mods',
                value: 'view'
            },
            {
                name: 'Add Mods',
                value: 'add'
            },
            {
                name: 'Remove Mods',
                value: 'remove'
            },
            new Separator(),
            {
                name: 'Change Name',
                value: 'edit'
            },
            {
                name: 'Delete List',
                value: 'delete'
            },
            new Separator(),
            {
                name: 'Return',
                value: 'return'
            },
        ],
        pageSize: 13
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

    if (selection == "add") {
        return await addModsMenu(foundList.id)
    }

    if (selection == "edit") {
        const name = await input({
            message: `Enter a new name for ${chalk.green.bold(foundList.name)}:`,
            validate: validateListName,
        }, { clearPromptOnDone: true })
        updateList(foundList.id, {
            ...foundList,
            name
        })

        return await viewList(foundList.id)
    }

    if (selection == "view") {
        return await viewMods(list)
    }

    if (selection == "remove") {
        return await removeModsMenu(list)
    }

    return await listsMenu()
}

async function viewMods(listId) {
    const foundList = getList(listId)

    const data = await dataFromIds(foundList.mods)

    const options = []
    if (data.length == 0) {
        options.push({
            name: " ",
            disabled: "No mods have been added to this list yet!"
        })
    }
    for (let mod of data) {
        options.push({
            name: mod.title,
            value: `mod-${mod['project_id']}`,
            description: `${chalk.yellowBright(mod.downloads + " downloads")} | ${chalk.magentaBright(mod.versions[mod.versions.length - 1])} | ${chalk.greenBright(mod.description)}`,
        })
    }
    console.log('\n')

    const selection = await select({
        message: `${chalk.italic(foundList.name)} | ${foundList.modCount} mods`,
        choices: [
            ...options,
            new Separator(),
            {
                name: chalk.bold.italic('Return'),
                value: 'return'
            },
            new Separator()
        ],
        pageSize: 13
    }, { clearPromptOnDone: true })

    if (selection) {
        console.clear()
        return await viewList(listId)
    }
}

//                      _     
//                     | |    
//  _ __ ___   ___   __| |___ 
// | '_ ` _ \ / _ \ / _` / __|
// | | | | | | (_) | (_| \__ \
// |_| |_| |_|\___/ \__,_|___/
// Mods

async function addModsMenu(listId) {
    const selection = await select({
        message: chalk.italic('What would you like to do?'),
        choices: [
            new Separator(),
            {
                name: 'All Modrinth Mods',
                value: 'all'
            },
            {
                name: 'Search Modrinth',
                value: 'search'
            },
            new Separator(),
            {
                name: 'Return',
                value: 'return'
            }
        ],
    }, { clearPromptOnDone: true })

    if (selection == "return") {
        return await viewList(listId)
    }
    if (selection == "search") {
        const query = await input({ message: "Enter search query:" }, { clearPromptOnDone: true })
        return await modrinthMenu(listId, 0, query)
    }

    if (selection == "all") {
        return await modrinthMenu(listId, 0, null)
    }
}

let modrinthMenuSelection = []
async function modrinthMenu(listId, page, query, cursor) {
    const data = await getModrinth(page, query)
    const foundList = getList(listId)

    const options = []
    if (data.hits.length == 0) {
        options.push({
            name: ' ',
            disabled: `No mods matching "${query}" found!`
        })
    }
    for (let mod of data.hits) {
        options.push({
            name: modrinthMenuSelection.includes(mod.project_id) ? chalk.cyan(mod.title) : mod.title,
            value: `mod-${mod['project_id']}`,
            description: `${chalk.yellowBright(mod.downloads + " downloads")} | ${chalk.magentaBright(mod.versions[mod.versions.length - 1])} | ${chalk.greenBright(mod.description)}`,
            disabled: foundList.mods.includes(mod.project_id) ? "(Already Added)" : false
        })
    }

    const maxPage = Math.ceil(data.total_hits / 20)

    const selection = await select({
        message: `Page ${page + 1} of ${maxPage} | Select mods from the list to add:`,
        choices: [
            new Separator(),
            ...options,
            new Separator(),
            {
                name: chalk.italic.bold('Next Page'),
                value: 'next',
                disabled: page + 1 == maxPage
            },
            {
                name: chalk.italic.bold('Previous Page'),
                value: 'previous',
                disabled: page == 0
            },
            new Separator(),
            {
                name: chalk.italic.bold('Confirm'),
                value: 'confirm',
                disabled: !modrinthMenuSelection.length > 0
            },
            {
                name: chalk.italic.bold('Return'),
                value: 'return'
            }
        ],
        pageSize: 16,
        default: cursor
    }, { clearPromptOnDone: true })

    if (selection.includes('mod-')) {
        const modId = selection.substring(4, selection.length)
        if (modrinthMenuSelection.includes(modId)) {
            const updatedArr = modrinthMenuSelection.filter((mod) => mod !== modId)
            modrinthMenuSelection = updatedArr

            return await modrinthMenu(listId, page, query, selection)
        }

        modrinthMenuSelection.push(modId)
        return await modrinthMenu(listId, page, query, selection)
    }

    if (selection == "next") {
        page++
        return await modrinthMenu(listId, page, query, selection)
    }

    if (selection == "previous") {
        page--
        return await modrinthMenu(listId, page, query, selection)
    }

    if (selection == "return") {
        modrinthMenuSelection = []
        return await addModsMenu(listId)
    }

    if (selection == "confirm") {
        const confirmation = await confirm({
            message: `Are you sure you want to add ${modrinthMenuSelection.length} mods to ${foundList.name}?`
        }, { clearPromptOnDone: true })

        if (confirmation == true) {
            updateList(listId, {
                ...foundList,
                mods: [...foundList.mods, ...modrinthMenuSelection],
                modCount: foundList.modCount += modrinthMenuSelection.length
            })
            modrinthMenuSelection = []
            return await viewList(listId)
        } else {
            return await modrinthMenu(listId, page, query)
        }
    }

}

let modsForRemoval = []
async function removeModsMenu(listId, cursor) {
    const foundList = getList(listId)
    const data = await dataFromIds(foundList.mods)

    const options = []
    if (data.length == 0) {
        options.push({
            name: " ",
            disabled: "No mods have been added to this list yet!"
        })
    }
    for (let mod of data) {
        options.push({
            name: modsForRemoval.includes(mod.id) ? chalk.cyan(mod.title) : mod.title,
            value: `mod-${mod['id']}`,
            description: `${chalk.yellowBright(mod.downloads + " downloads")} | ${chalk.magentaBright(mod.versions[mod.versions.length - 1])} | ${chalk.greenBright(mod.description)}`,
        })
    }

    const selection = await select({
        message: `${chalk.italic(foundList.name)} | ${foundList.modCount} mods`,
        choices: [
            ...options,
            new Separator(),
            {
                name: chalk.bold.italic('Confirm'),
                value: 'confirm',
                disabled: !modsForRemoval.length > 0
            },
            {
                name: chalk.bold.italic('Return'),
                value: 'return'
            },
            new Separator()
        ],
        pageSize: 17,
        default: cursor
    }, { clearPromptOnDone: true })

    if (selection.includes("mod-")) {
        const modId = selection.substring(4, selection.length)
        if (modsForRemoval.includes(modId)) {
            const updatedArr = modsForRemoval.filter((mod) => mod !== modId)
            modsForRemoval = updatedArr

            return await removeModsMenu(listId, selection)
        }

        modsForRemoval.push(modId)
        return await removeModsMenu(listId, selection)
    }

    if (selection == "confirm") {
        const confirmation = await confirm({
            message: `Are you sure you want to remove ${modsForRemoval.length} mods from ${foundList.name}?`
        }, { clearPromptOnDone: true })

        if (confirmation == true) {

            const updatedList = foundList.mods.filter((mod) => !modsForRemoval.includes(mod))

            updateList(listId, {
                ...foundList,
                mods: updatedList,
                modCount: foundList.modCount - modsForRemoval.length
            })
            modsForRemoval = []
            return await removeModsMenu(listId)
        } else {
            return await removeModsMenu(listId)
        }
    }

    if (selection == "return") {
        modsForRemoval = []
        return await viewList(listId)
    }
}



async function main() {
    console.clear()
    // Main Menu
    await mainMenu()
}

main()