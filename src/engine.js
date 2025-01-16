
const fs = require('fs/promises');
const readline = require('node:readline');
const { FixedSizeStack } = require('./fixed-size-stack');
const { Identifier } = require('./identifiers');
const { Adventure } = require('./adventure');

/** @typedef {import('./identifiers').Identifier} Identifier */

const ADVENTURE_FILE_EXTENSION = 'json';
const INKSPIRE_NAMESPACE = 'inkspire';
const MAX_RETURN_HISTORY = 16;

class AdventureEngine {
	/**
	 * @param {Object} params
	 * @param {function(): Promise} params.read
	 * @param {function(string): void} params.write
	 * @param {string=} params.adventureDir
	 */
	constructor({ read, write, adventureDir = 'adventures' }) {
		this.read = read;
		this.write = write;

		this.adventureDir = adventureDir;
		this.adventures = /** @type {Object.<string, Adventure>} */ {};
		const scenes = this.scenes = /** @type {Object.<string, Scene>} */ {};
		const variables = this.variables = /** @type {Object.<string, number>} */ {};

		this.loadAdventure(new Adventure({
			title: "Inkspire System",
			name: INKSPIRE_NAMESPACE,
			author: "Lightning",
			version: 1,
			startingScene: 'exit',
			scenes: [
				{ title: 'Unfinished Switch Scene', name: 'switch', content: ['TODO'], options: [] },
				{ title: 'Unfinished Fail Scene', name: 'fail', content: ['TODO'], options: [] },
				{ title: 'Unfinished Completion Scene', name: 'pass', content: ['TODO'], options: [] },
				{ title: 'Unfinished Exit Scene', name: 'exit', content: ['TODO'], options: [] },
				{ title: 'Unfinished Back Scene', name: 'back', content: ['TODO'], options: [] }
			],
		}, scenes, variables));
	}

	/**
	 * @param {Adventure} adventure
	 * @return {Adventure}
	 */
	loadAdventure(adventure) {
		const { adventures } = this, adventureName = adventure.name;
		if (adventures.hasOwnProperty(adventureName)) {
			console.error(`An adventure with the name ${adventureName} is already loaded.`);
			process.exit();
		}
		return this.adventures[adventureName] = adventure;
	}

	/**
	 * @param {string} filepath
	 * @return {Promise<AdventureEngine>} this
	 */
	async loadFile(filepath) {
		const data = await fs.readFile(filepath, 'utf8');
		const adventure = await this.loadAdventure(new Adventure(JSON.parse(data), this.scenes, this.variables));

		const { requires } = adventure;
		if (requires) {
			const { adventures, adventureDir } = this;
			const loadPromises = requires
				.filter(n => !adventures.hasOwnProperty(n))
				.map((name) => this.loadFile(`${adventureDir}/${name}.${ADVENTURE_FILE_EXTENSION}`));
			for (const loadPromise of loadPromises) {
				await loadPromise;
			}
		}
		return this;
	}

	/*** @returns {AdventureEngine} this */
	linkAdventures() {
		const { scenes } = this;
		for (const [, adventure] of Object.entries(this.adventures)) {
			adventure.actions.forEach((action) => action.evaluate());

			const identifier = adventure.startingScene;
			adventure.startingScene = scenes[identifier];
			adventure.startingScene.identifier = identifier;
		}
		for (const [, { options }] of Object.entries(scenes)) {
			for (const option of options) {
				const identifier = option.target;
				option.target = scenes[identifier];
				option.target.identifier = identifier;
			}
		}
		return this;
	}

	/**
	 * @param {string} adventureName
	 * @return {Promise<AdventureEngine>} this
	 */
	async runAdventure(adventureName) {
		const { adventures, write, read } = this;

		if (!adventures.hasOwnProperty(adventureName)) {
			write(`FAIL: No adventure of named ${adventureName} is loaded.`);
			return this;
		}

		const history = new FixedSizeStack(MAX_RETURN_HISTORY);
		let currentScene = /** @type {Scene} */ adventures[adventureName].startingScene;

		while (true) {
			if (Identifier.getNamespace(currentScene.identifier) === INKSPIRE_NAMESPACE) {
				switch (currentScene.name) {
					case 'switch': throw new Error('Not implemented');
					case 'fail': write('You failed'); return this;
					case 'pass': write('You win'); return this;
					case 'exit': write('Program terminated'); process.exit(); break;
					case 'back': currentScene = history.pop(); continue;
				}
			}

			const { title, content, actions, options, adventure: { globalTop, globalBottom } } = currentScene;
			actions.forEach((action) => action.evaluate());

			write('');
			write('');
			write('');
			write('');
			write('');
			write('');
			write('');
			write('');
			write('');
			write('');
			write('');

			write(title.evaluate());
			(globalTop) && write(globalTop.evaluate());
			content.map((line) => line.evaluate()).filter(Boolean).forEach((line) => write(line));
			(globalBottom) && write(globalBottom.evaluate());

			if (options.length === 1) {
				const option = options[0], label = option.label.evaluate();
				(label) && write('You ' + label[0].toLowerCase() + label.slice(1));
				write('Press enter to continue...');
				await read();

				currentScene = option.target;
				option.actions.forEach((action) => action.evaluate());
				continue;
			}

			const unavailableOptions = [], availableOptions = [];
			options.forEach((option) => {
				(!option.condition || option.condition.evaluate())
					? availableOptions.push(option)
					: unavailableOptions.push(option);
				return false;
			});

			write('');
			write('You could...');
			availableOptions
				.forEach((option, i) => write(`${i+1}: ${option.label.evaluate()}`));
			unavailableOptions
				.filter((option) => option.alwaysVisible)
				.forEach((option) => write(`X: ${option.label.evaluate()}`));
			write('');

			const response = await this.getChoice(options.length);
			const chosenOption = availableOptions[response - 1];
			chosenOption.actions.forEach((action) => action.evaluate());
			currentScene = chosenOption.target;
		}

	}

	/**
	 * @param {number} numOptions
	 * @return {Promise<number>}
	 */
	async getChoice(numOptions) {
		const { write, read } = this;

		while (true) {
			write('What do you do?');
			const response = (await read()).trim(), choice = Number(response);
			if (isNaN(choice) || choice < 1 || choice > numOptions) {
				write(`Select one of the options by entering a number from 1 to ${numOptions}.`);
				continue;
			}
			return choice;
		}
	}
}


const main = async () => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const engine = new AdventureEngine({
		read: () => new Promise((resolve) => rl.question('', (answer) => resolve(answer))),
		write: console.log,
	});

	await engine.loadFile('adventures/adventure.json');
	engine.linkAdventures();
	await engine.runAdventure('adventure');

	console.log('Adventure ended');
};

main().then();
