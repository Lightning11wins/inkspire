
/** @typedef {string} Identifier */

/**
 * @param {string} namespace
 * @param {string} name
 * @return {Identifier}
 */
const asIdentifier = (namespace, name) => `${namespace}:${name}`;

/**
 * @param {string} identifierString
 * @param {string} defaultNamespace
 * @param {ParserContext=} context
 * @return {Identifier}
 */
const parseIdentifier = (identifierString, defaultNamespace, context) => {
	context && (context.identifier = identifierString);
	const parts = identifierString.split(':', 3);
	if (parts.length > 2) {
		context.throwError('identifier', `Malformed identifier ${identifierString}.`);
	}
	return (parts.length === 2)
		? asIdentifier(parts[0], parts[1])
		: asIdentifier(defaultNamespace, parts[0]);
};

const identifierRegex = /^([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)$/;
/**
 * @param {any} candidateIdentifier
 * @returns {boolean}
 */
const isValidIdentifier = (candidateIdentifier) => identifierRegex.test(candidateIdentifier);

/**
 * @param {string} identifier
 * @returns {string}
 */
const getIdentifierNamespace = (identifier) => {
	const parts = identifier.split(':', 3);
	if (parts.length !== 2) {
		throw new Error(`Malformed identifier: ${identifier}`);
	}
	return parts[0];
};

/**
 * @param {string} identifier
 * @returns {string}
 */
const getIdentifierName = (identifier) => {
	const parts = identifier.split(':', 3);
	if (parts.length !== 2) {
		throw new Error(`Malformed identifier: ${identifier}`);
	}
	return parts[1];
};

module.exports = {
	Identifier: {
		from: asIdentifier,
		parse: parseIdentifier,
		regex: identifierRegex,
		isValid: isValidIdentifier,
		getNamespace: getIdentifierNamespace,
		getName: getIdentifierName,
	},
	asIdentifier,
	parseIdentifier,
	identifierRegex,
	isValidIdentifier,
	getIdentifierNamespace,
	getIdentifierName,
};
