import { input, select, Separator, confirm } from "@inquirer/prompts"
import Conf from 'conf'
import axios from "axios"
import { nanoid } from "nanoid"
import chalk from 'chalk';
import ora from "ora"

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

const RETURN_BTN = {name: chalk.bold.italic('Return'), value: 'return'}
const CANCEL_BTN = {name: chalk.bold.italic('Cancel'), value: 'cancel'}

async function validateListName(name) {
    // initial validation
    if (name.trim() === "") {
        return 'List name cannot be empty.'
    } else if (name.length > 24) {
        return 'List name cannot exceed 24 characters.'
    }

    // check if unique
    const lists = config.get('modLists')
    for (let list of lists) {
        if (list.name == name) {
            return `A list with the name '${name}' already exists.`
        }
    }
    return true
}

// delete list prompt
async function deleteList(listId) {
    const foundList = getListFromId(listId)
    const confirmation = await confirm({ message: `Are you sure you want to delete ${chalk.green.bold(foundList.name)}?` }, { clearPromptOnDone: true })

    if (confirmation == true) {
        const currentLists = config.get('modLists')
        const updatedList = currentLists.filter((list) => list.id !== listId)

        config.set('modLists', updatedList)
        return await listsMenu()
    } else {
        return await viewList(foundList.id)
    }
}

// edit list name prompt
async function editListName(listId) {
    const foundList = getListFromId(listId)
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

// update list in config
function updateList(listId, data) {
    const allLists = config.get('modLists')
    // get and set required list
    const reqListIndex = allLists.findIndex((list) => list.id == listId)
    allLists[reqListIndex] = data

    config.set('modLists', allLists)
}

// get a list from id
function getListFromId(listId) {
    const allLists = config.get('modLists')
    const foundList = allLists.filter((list) => list.id == listId)[0]
    return foundList
}

// query modrinth for mods
async function getModrinth(page, query) {
    const spinner = ora('Loading...').start()
    try {
        const res = await axios.get(
            `https://api.modrinth.com/v2/search`,
            { params: { query: query, limit: 20, offset: page * 20 } }
        )
        spinner.stop()
        return res.data
    } catch (e) {
        spinner.fail('Something went wrong!')
        return await listsMenu()
    }
}

// returns modrinth data from a set of ids
async function dataFromIds(ids) {
    const spinner = ora('Loading...').start()
    try {
        const res = await axios.get(
            `https://api.modrinth.com/v2/projects`,
            { params: { ids: JSON.stringify(ids) } }
        )
        spinner.stop()
        return res.data
    } catch (e) {
        spinner.fail('Something went wrong!')
        return await listsMenu()
    }
}

async function setDownloadPath() {
    const newPath = await input({ message: 'Enter a new path where you want mods to be downloaded or type "c" to cancel:' }, { clearPromptOnDone: true })
    if (newPath == "c") {
        return await optionsMenu()
    } else {
        config.set('downloadPath', newPath.trim())
        return await optionsMenu()
    }
}

function createList(name) {
    const currentLists = config.get('modLists')
    const newList = {
        id: nanoid(),
        name: name.trim(),
        modCount: 0,
        mods: []
    }
    config.set('modLists', [...currentLists, newList])
    return newList
}

async function getGameVersions () {
    const spinner = ora('Loading...').start()
    try {
        const res = await axios.get(`https://api.modrinth.com/v2/tag/game_version`)
        const output = {
            snapshot: [],
            release: [],
            beta: [],
            alpha: [],
        }

        for (let ver of res.data) {
            output[ver["version_type"]].push(ver.version)
        }
        spinner.stop()
        return output
    } catch (e) {
        spinner.fail("Couldn't get game versions!")
        return await mainMenu()
    }
}

async function getLoaders () {
    const spinner = ora('Loading...').start()
    try {
        const res = await axios.get(`https://api.modrinth.com/v2/tag/loader`)

        const output = []
        for (let loader of res.data) {
            if (loader["supported_project_types"][0] == "mod") {
                output.push(loader.name)
            }
        }
        spinner.stop()
        return output
    } catch (e) {
        spinner.fail("Couldn't get loaders!")
        return await mainMenu()
    }
}

// get compatible mods with version and loader from list
async function getCompatibleMods (version, loader, modList) {
    const mods = await dataFromIds(modList)

    const compatibleMods = []
    // filter results and push to arr
    for (let mod of mods) {
        if (mod["game_versions"].includes(version)) {
            if (mod["loaders"].includes(loader)) {
                compatibleMods.push(mod["id"])
            }
        }
    }

    return compatibleMods
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
            { name: 'Mod Lists', value: 'lists' },
            { name: 'Download Mods', value: 'download' },
            { name: 'Options', value: 'options' }
        ],
    }, { clearPromptOnDone: true })

    switch (selection) {
        case "lists":
            return await listsMenu()
        case "options":
            return await optionsMenu()
        case "download":
            return await downloadMenu()
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
            RETURN_BTN
        ]
    }, { clearPromptOnDone: true })

    switch (selection) {
        case "downloadPath":
            return await setDownloadPath()
        case "return":
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
        modListsOptions.push({ name: ' ', disabled: 'No lists found!' })
    } // provide message for empty list
    for (let modList of modLists) {
        modListsOptions.push({
            name: modList.name,
            value: `list-${modList.id}`,
            description: chalk.dim(`| ${modList.name} | ${modList.modCount} mods |`)
        })
    } // parse for choices

    const choices = [
        new Separator(),
        ...modListsOptions,
        new Separator(),
        { name: chalk.italic('Create List'), value: 'create' },
        new Separator(),
        RETURN_BTN,
    ] // merge list options with static options

    const selection = await select({
        message: chalk.italic("Your Mod Lists"),
        choices: choices,
        pageSize: 11,
    }, { clearPromptOnDone: true })

    if (selection.includes('list-')) { // check if list was selected
        const listId = selection.substring(5, selection.length) // parse list id
        return await viewList(listId)
    }
    switch (selection) {
        case "create":
            return await createListMenu()
        case "return":
            return await mainMenu()
    }
}

async function createListMenu() {
    const name = await input({
        message: "Enter a name for your new mod list:",
        validate: validateListName,
    }, { clearPromptOnDone: true })

    const newList = createList(name)
    return await viewList(newList.id)
}

async function viewList(listId) {
    const foundList = getListFromId(listId)

    const selection = await select({
        message: `${chalk.italic(foundList.name)} | ${foundList.modCount} mods`,
        choices: [
            new Separator(),
            { name: 'View Mods', value: 'view' },
            { name: 'Add Mods', value: 'add' },
            { name: 'Remove Mods', value: 'remove' },
            new Separator(),
            { name: 'Change Name', value: 'edit' },
            { name: 'Delete List', value: 'delete' },
            new Separator(),
            RETURN_BTN,
        ],
        pageSize: 13
    }, { clearPromptOnDone: true })

    switch (selection) {
        case "add":
            return await addModsMenu(listId)
        case "view":
            return await viewMods(listId)
        case "remove":
            return await removeModsMenu(listId)
        case "delete":
            return await deleteList(listId)
        case "edit":
            return await editListName(listId)
        case "return":
            return await listsMenu()
    }
}

async function viewMods(listId) {
    const foundList = getListFromId(listId)
    const data = await dataFromIds(foundList.mods)

    const options = []
    if (data.length == 0) {
        options.push({ name: " ", disabled: "No mods have been added to this list yet!" }) // provide message for empty list
    }
    for (let mod of data) {
        options.push({
            name: mod.title,
            value: `mod-${mod['project_id']}`,
            description: `${chalk.yellowBright(mod.downloads + " downloads")} | ${chalk.magentaBright(mod["game_versions"][mod["game_versions"].length - 1])} | ${chalk.greenBright(mod.description)}`,
        })
    }
    console.log('\n')

    const selection = await select({
        message: `${chalk.italic(foundList.name)} | ${foundList.modCount} mods`,
        choices: [
            ...options,
            new Separator(),
            RETURN_BTN,
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
            { name: 'All Modrinth Mods', value: 'all' },
            { name: 'Search Modrinth', value: 'search' },
            new Separator(),
            RETURN_BTN
        ],
    }, { clearPromptOnDone: true })

    switch (selection) {
        case "all":
            return await modrinthMenu(listId, 0, null)
        case "search":
            const query = await input({ message: "Enter search query:" }, { clearPromptOnDone: true })
            return await modrinthMenu(listId, 0, query)
        case "return":
            return await viewList(listId)
    }
}

let modrinthMenuSelection = []
async function modrinthMenu(listId, page, query, cursor) {
    const data = await getModrinth(page, query)
    const maxPage = Math.ceil(data.total_hits / 20)
    const foundList = getListFromId(listId)

    const options = []
    if (data.hits.length == 0) {
        options.push({ name: ' ', disabled: `No mods matching "${query}" found!` })
    }
    for (let mod of data.hits) {
        options.push({
            name: modrinthMenuSelection.includes(mod.project_id) ? chalk.greenBright.bold.italic(mod.title) : mod.title,
            value: `mod-${mod['project_id']}`,
            description: `${chalk.yellowBright(mod.downloads + " downloads")} | ${chalk.magentaBright(mod.versions[mod.versions.length - 1])} | ${chalk.greenBright(mod.description)}`,
            disabled: foundList.mods.includes(mod.project_id) ? "(Already Added)" : false
        })
    }

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
            RETURN_BTN
        ],
        pageSize: 16,
        default: cursor
    }, { clearPromptOnDone: true })

    if (selection.includes('mod-')) { // handle selection
        const modId = selection.substring(4, selection.length) // parse mod id

        if (modrinthMenuSelection.includes(modId)) {
            const updatedArr = modrinthMenuSelection.filter((mod) => mod !== modId)
            modrinthMenuSelection = updatedArr

            return await modrinthMenu(listId, page, query, selection)
        }
        modrinthMenuSelection.push(modId)
        return await modrinthMenu(listId, page, query, selection)
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

    switch (selection) {
        case "next":
            page++
            return await modrinthMenu(listId, page, query, selection)
        case "previous":
            page--
            return await modrinthMenu(listId, page, query, selection)
        case "return":
            modrinthMenuSelection = []
            return await addModsMenu(listId)
    }
}

let modsForRemoval = []
async function removeModsMenu(listId, cursor) {
    const foundList = getListFromId(listId)
    const data = await dataFromIds(foundList.mods)

    const options = []
    if (data.length == 0) {
        options.push({ name: " ", disabled: "No mods have been added to this list yet!" })
    }
    for (let mod of data) {
        options.push({
            name: modsForRemoval.includes(mod.id) ? chalk.redBright.bold.italic(mod.title) : mod.title,
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
            RETURN_BTN,
            new Separator()
        ],
        pageSize: 17,
        default: cursor
    }, { clearPromptOnDone: true })

    if (selection.includes("mod-")) { // handle selection
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



//      _                     _                 _     
//     | |                   | |               | |    
//   __| | _____      ___ __ | | ___   __ _  __| |___ 
//  / _` |/ _ \ \ /\ / / '_ \| |/ _ \ / _` |/ _` / __|
// | (_| | (_) \ V  V /| | | | | (_) | (_| | (_| \__ \
//  \__,_|\___/ \_/\_/ |_| |_|_|\___/ \__,_|\__,_|___/
// Downloads

async function downloadMenu() {
    const lists = config.get('modLists')

    const listChoices = []
    if (lists.length == 0) {
        listChoices.push({ name: ' ', disabled: 'No lists found!' })
    } // provide message for empty list
    for (let list of lists) {
        listChoices.push({
            name: list.name,
            value: `list-${list.id}`,
            description: chalk.dim(`| ${list.name} | ${list.modCount} mods |`)
        })
    } // parse for choices

    const listSelection = await select({
        message: `Choose a list to download:`,
        choices: [
            new Separator(),
            ...listChoices,
            new Separator(),
            RETURN_BTN,
        ],
        pageSize: 13
    }, { clearPromptOnDone: true })

    if (listSelection.includes('list-')) {
        const listId = listSelection.substring(5, listSelection.length)
        return await downloadSelectionMenu(listId)
    }

    return await mainMenu()
}

async function downloadSelectionMenu (listId) {
    const foundList = getListFromId(listId)

    const verTypeSelection = await select({
        message: `(${chalk.bold.italic(foundList.name)}) Select what versions you want to choose from: \n`,
        choices: [
            {name: 'Full Releases', value: 'release'},
            {name: 'Snapshots', value: 'snapshot'},
            {name: 'Old Versions (beta/alpha)', value: 'old'},
            new Separator(),
            CANCEL_BTN,
            new Separator()
        ],
        pageSize: 6
    }, {clearPromptOnDone: true})

    if (verTypeSelection == "cancel") {
        return await downloadMenu()
    }

    const versions = await getGameVersions()
    const parsedVers = []

    if (verTypeSelection == "old") {
        for (let ver of versions.beta) {
            parsedVers.push({name: ver, value: ver})
        }
        for (let ver of versions.alpha) {
            parsedVers.push({name: ver, value: ver})
        }
    } else {
        for (let ver of versions[verTypeSelection]) {
            parsedVers.push({name: ver, value: ver})
        }
    }

    const verSelection = await select ({
        message: `(${chalk.bold.italic(foundList.name)}) Choose a version to download mods for: \n`,
        choices: [
            new Separator(),
            ...parsedVers,
            new Separator(),
            CANCEL_BTN
        ],
        pageSize: 15
    }, {clearPromptOnDone: true})
    
    if (verSelection == "cancel") {
        return await downloadMenu()
    }

    const loaders = await getLoaders()
    const parsedLoaders = []
    for (let loader of loaders) {
        parsedLoaders.push({name: loader, value: loader})
    }

    const loaderSelection = await select ({
        message: `(${chalk.bold.italic(foundList.name)}) Choose a loader you want to download mods for: \n`,
        choices: [
            new Separator(),
            ...parsedLoaders,
            new Separator(),
            CANCEL_BTN
        ],
        pageSize: 15
    }, {clearPromptOnDone: true})

    if (loaderSelection == "cancel") {
        return await downloadMenu()
    }

    return await handleDownload (verSelection, loaderSelection, listId)
}

async function handleDownload (ver, loader, listId) {
    const list = getListFromId(listId)

    // get available mods for ver
    const compatibleMods = await getCompatibleMods(ver, loader, list.mods)
    console.log(compatibleMods)
}



// Initialize
async function main() {
    console.clear()
    return await mainMenu()
}
main()