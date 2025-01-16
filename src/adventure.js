
const { Action, Conditional, separatorRegex, variableRegex } = require('./variables');
const { Identifier } = require('./identifiers');

/** @typedef {import('./identifiers').Identifier} Identifier */

const isValidVersionNumber = (versionNumber) => {
	return typeof versionNumber === 'number' && versionNumber === 1;
};

class ParserContext {
	constructor() {
		this.adventure = '';
		this.scene = '';
		this.option = '';
		this.identifier = '';
	}
	throwError(location, message) {
		console.error(`ParserError in ${location}: ${message}`);
		// noinspection FallThroughInSwitchStatementJS
		switch (location) {
			default: console.error('Invalid location:', location);
			case "identifier": console.error('Identifier:', this.identifier ?? 'unknown');
			case "option": console.error('Option:', this.option ?? 'unknown');
			case "scene": console.error('Scene:', this.scene ?? 'unknown');
			case "adventure": console.error('Adventure:', this.adventure ?? 'unknown');
		}
		process.exit();
	}
}

class Adventure {
	/**
	 * @param {Object} sceneJSON
	 * @param {string|undefined} sceneJSON.title
	 * @param {string|undefined} sceneJSON.name
	 * @param {string|undefined} sceneJSON.author
	 * @param {number|undefined} sceneJSON.version
	 * @param {string|undefined} sceneJSON.requires
	 * @param {string|undefined} sceneJSON.actions
	 * @param {string|undefined} sceneJSON.globalTop
	 * @param {string|undefined} sceneJSON.globalBottom
	 * @param {string|undefined} sceneJSON.startingScene
	 * @param {Array<Object>|undefined} sceneJSON.scenes
	 * @param {Object.<string, Scene>} sceneRegistry
	 * @param {Object.<string, number>} variableRegistry
	 */
	constructor({ title, name, author, version, requires, actions, globalTop, globalBottom, startingScene: startSceneName, scenes: scenesObjects }, sceneRegistry, variableRegistry) {
		const context = new ParserContext();

		if (!name && name.length) {
			context.throwError('adventure', 'name is a required field.');
		}
		if (typeof name !== 'string') {
			context.throwError('adventure', 'name must be a string.');
		}
		if (name.includes(':')) {
			context.throwError('adventure', 'name cannot contain a colon.');
		}
		this.name = name;
		context.adventure = name;

		if (!title && title.length) {
			context.throwError('adventure', 'title is a required field.');
		}
		if (typeof title !== 'string') {
			context.throwError('adventure', 'title must be a string.');
		}
		this.title = new Text(title, variableRegistry, name, context);

		if (!version) {
			context.throwError('adventure', 'version is a required field.');
		}
		if (!isValidVersionNumber(version)) {
			context.throwError('adventure', `invalid version number: ${version}`);
		}
		this.version = version;

		this.author = new Text(title, variableRegistry, name, context);
		this.requires = (requires) ? requires.split(separatorRegex).map(n => n.trim()).filter(n => n).filter(n => n !== 'inkspire') : [];
		this.actions = Action.parseActions(actions, variableRegistry, name, context);
		this.globalTop = (globalTop) ? new Text(title, variableRegistry, name, context) : '';
		this.globalBottom = (globalBottom) ? new Text(title, variableRegistry, name, context) : '';
		this.startingScene = Identifier.parse(startSceneName ?? 'start', name);

		for (const sceneObject of scenesObjects) {
			const scene = new Scene(sceneObject, this, variableRegistry, context);
			const { name: sceneName } = scene, sceneIdentifier = Identifier.from(name, sceneName);
			if (sceneRegistry.hasOwnProperty(sceneIdentifier)) {
				context.throwError('adventure', `Scene identifiers must be unique and ${sceneIdentifier} is not.`);
			}

			sceneRegistry[sceneIdentifier] = scene;
		}
	}

	toJSON() {
		const { startingScene } = this;
		if (startingScene instanceof Scene) {
			return Object.assign({}, this, { startingScene })
		}
		return this;
	}
}

class Scene {
	/**
	 * @param {Object} sceneJSON
	 * @param {string|undefined} sceneJSON.title
	 * @param {string|undefined} sceneJSON.name
	 * @param {string|undefined} sceneJSON.actions
	 * @param {string|undefined} sceneJSON.content
	 * @param {Array<Object>|undefined} sceneJSON.options
	 * @param {Adventure} adventure
	 * @param {Object.<string, number>} variableRegistry
	 * @param {ParserContext=} context
	 */
	constructor({ title, name, actions, content, options}, adventure, variableRegistry, context) {
		if (!adventure) {
			const obj = JSON.stringify({ adventure, title, name, actions, content, options}, null, 2);
			throw new Error('Scene created without a parent adventure: ' + obj +  '\ncontext: ' + JSON.stringify(context, null, 2));
		}
		this.adventure = adventure;
		const defaultNamespace = adventure.name;

		if (!name || !name.length) {
			context.throwError('scene', 'name is a required field.');
		}
		if (name.includes(':')) {
			context.throwError('scene', 'name cannot contain a colon.');
		}
		this.name = name;
		context.scene = name;

		if (!title || !title.length) {
			context.throwError('scene', 'title is a required field.');
		}
		this.title = new Text(title, variableRegistry, defaultNamespace, context);

		if (!content) {
			context.throwError('scene', 'content is a required field.');
		}
		if (typeof content !== 'object' || content.length < 1) {
			context.throwError('scene', 'invalid content: ' + JSON.stringify(content, null, 2));
		}
		this.content = content.map((line) => new Text(line, variableRegistry, defaultNamespace, context));

		this.identifier = ''; // Handled by the linker.
		this.actions = Action.parseActions(actions, variableRegistry, defaultNamespace, context);
		this.options = options.map((option) => new Option(option, variableRegistry, defaultNamespace, context));
	}
}

class Option {
	/**
	 * @param {Object} optionJSON
	 * @param {string|undefined} optionJSON.label
	 * @param {string|undefined} optionJSON.target
	 * @param {string|undefined} optionJSON.condition
	 * @param {boolean|undefined} optionJSON.alwaysVisible
	 * @param {string|undefined} optionJSON.actions
	 * @param {Object.<string, number>} variableRegistry
	 * @param {string} defaultNamespace
	 * @param {ParserContext=} context
	 */
	constructor({ label, target, condition, alwaysVisible, actions }, variableRegistry, defaultNamespace, context) {
		if (label === undefined) {
			context.throwError('option', 'label is a required field.');
		}
		this.label = new Text(label, variableRegistry, defaultNamespace, context);
		context.option = label;

		if (!target) {
			context.throwError('option', 'target is a required field.');
		}
		this.target = Identifier.parse(target, defaultNamespace, context);

		if (alwaysVisible !== undefined && typeof alwaysVisible !== 'boolean') {
			context.throwError('option', `Invalid value for alwaysVisible: ${alwaysVisible}.`);
		}

		this.condition = (condition) && new Conditional(condition, variableRegistry, defaultNamespace, context);
		this.actions = Action.parseActions(actions, variableRegistry, defaultNamespace, context);
		this.alwaysVisible = alwaysVisible ?? false;
	}

	toJSON() {
		const { target } = this;
		if (target instanceof Scene) {
			return Object.assign({}, this, { target: target.identifier.toString()})
		}
	}
}

class Text {
	/**
	 * @param {string} str
	 * @param {Object.<string, number>} variables
	 * @param {string} defaultNamespace
	 * @param {ParserContext=} context
	 */
	constructor(str, variables, defaultNamespace, context) {
		this.tokens = str
			.split(/(\${[^}]+}|\?\{[^}]+})/g)
			.filter(Boolean)
			.map((token) => {
				const variableMatch = /\${(.*?)}/.exec(token);
				if (variableMatch) {
					const varName = variableMatch[1];
					if (!variableRegex.test(varName)) {
						console.warn('Got strange variable name: ' + varName);
					}
					const identifier = Identifier.parse(variableMatch[1], defaultNamespace);
					return { evaluate: () => variables[identifier] };
				}

				const conditionalMatch = /\?\{([^?]+)\?([^:]+)(?::([^}]+))?}/.exec(token);
				if (conditionalMatch) {
					const conditional = new Conditional(conditionalMatch[1], variables, defaultNamespace, context);
					const text1 = new Text(conditionalMatch[2], variables, defaultNamespace, context);
					const text2 = (conditionalMatch[3]) ? new Text(conditionalMatch[3], variables, defaultNamespace, context) : undefined;

					return (text2)
						? { evaluate: () => (conditional.evaluate()) ? text1.evaluate() : text2.evaluate() }
						: { evaluate: () => (conditional.evaluate()) ? text1.evaluate() : '' };
				}

				return { evaluate: () => token };
			});
	}

	evaluate() {
		return this.tokens.map((token) => token.evaluate()).join('');
	}
}

module.exports = {
	Adventure,
	Scene,
	Action,
	Text
};
