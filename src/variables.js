
const { Identifier } = require('./identifiers');
const assert = require('assert');

// Define regex expressions.
const actionRegex = /(.*?)([+\-*/]?=)(.*)/;
const actionTokenRegex = /\d+(\.\d+)?|[a-zA-Z_][a-zA-Z0-9_:]*|[+\-*/%()]/g;
const conditionalTokenRegex = /\w+|>=|<=|==|=|&&|\|\||[()]|[-\d]+/g;
const numberRangeRegex = /(\w+)=(\d+)\.\.(\d+)/g;
const numberRegex = /^\d+(\.\d+)?$/;
const variableRegex = /^[a-zA-Z_][a-zA-Z0-9_:]*$/;
const whiteSpaceRegex = /\s+/g;
const separatorRegex = /[,;]/;

class Action {
	/**
	 * @param {string} actions
	 * @param {Object} variables
	 * @param {string} defaultNamespace
	 * @param {ParserContext} context
	 * @return {Action[]|[]}
	 */
	static parseActions(actions, variables, defaultNamespace, context) {
		return (actions)
			? actions
				.split(separatorRegex)
				.map((action) => action.replaceAll(' ', '').trim())
				.map((action) => new Action(action, variables, defaultNamespace, context))
			: [];
	}

	constructor(action, variables, defaultNamespace, context) {
		const match = action.match(actionRegex);
		if (!match) {
			context.throwError('adventure', 'Malformed action: ' + action);
		}

		this.variableName = Identifier.parse(match[1].trim(), defaultNamespace);
		this.operator = match[2].trim();
		const expression = match[3].trim();

		this.variables = variables;
		this.evaluator = Action.createEvaluator(expression, variables, defaultNamespace, context);
	}

	evaluate() {
		const { variableName, variables } = this;
		const value = this.evaluator();

		switch (this.operator) {
			case '=': variables[variableName] = value; break;
			case '+=': variables[variableName] += value; break;
			case '-=': variables[variableName] -= value; break;
			case '*=': variables[variableName] *= value; break;
			case '/=': variables[variableName] /= value; break;
		}
	}

	static createEvaluator(expression, variables, defaultNamespace, context) {
		if (typeof expression !== 'string' || typeof variables !== 'object' || variables === null) {
			throw new Error('Invalid input: Expression must be a string and variables an object.');
		}

		// Define accepted mathematical operators.
		const operators = {
			'+': (a, b) => a + b,
			'-': (a, b) => a - b,
			'*': (a, b) => a * b,
			'/': (a, b) => a / b,
			'%': (a, b) => a % b,
		};

		// Tokenize the expression.
		const tokens = expression.match(actionTokenRegex);
		if (!tokens) {
			context.throwError('adventure', 'Invalid expression: ' + expression);
		}

		// Shunting-yard algorithm to handle parentheses and operator precedence
		const outputQueue = [];
		const operatorStack = [];

		for (const token of tokens) {
			if (numberRegex.test(token)) {
				// Numbers go directly to the output queue.
				outputQueue.push(parseFloat(token));
			} else if (variableRegex.test(token)) {
				// Store instructions to look up variable values later.
				outputQueue.push('v' + Identifier.parse(token, defaultNamespace));
			} else if (operators[token]) {
				// Operators are pushed onto the operator stack, accounting for precedence.
				while (
					operatorStack.length &&
					operators[operatorStack[operatorStack.length - 1]] &&
					/^[+-]$/.test(token) // +- have higher precedence than the other operators.
				) {
					outputQueue.push(operatorStack.pop());
				}
				operatorStack.push(token);
			} else if (token === '(') {
				// The '(' is pushed, just like other operators.
				operatorStack.push(token);
			} else if (token === ')') {
				// The ')' moves the terms since the last '(' to the output queue.
				while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
					outputQueue.push(operatorStack.pop());
				}
				if (operatorStack.pop() !== '(') {
					context.throwError('adventure', 'Mismatched parentheses: ' + expression);
				}
			}
		}

		// Pop remaining operators onto the output queue
		while (operatorStack.length) {
			outputQueue.push(operatorStack.pop());
		}

		// Evaluate the RPN expression
		return () => {
			const stack = [];
			outputQueue.forEach((token) => {
				if (typeof token === 'number') {
					stack.push(token);
				} else if (token.startsWith('v')) {
					const name = token.slice(1), value = variables[name];
					if (value === undefined) {
						throw new Error(`Variable ${name} used before assignment.`);
					}
					stack.push(value);
				} else if (operators[token]) {
					const b = stack.pop();
					const a = stack.pop();
					stack.push(operators[token](a, b));
				} else { // TODO: Verify impossible and remove.
					console.error(`Encountered unexpected token ${token} while executing action.`);
				}
			});
			if (stack.length > 1) {
				console.warn('Extra items in stack: ' + JSON.stringify(stack));
			}
			return stack[0];
		};
	}
}

class Conditional {
	constructor(conditionExpression, variables, defaultNamespace, context) {
		this.variables = variables;
		this.defaultNamespace = defaultNamespace;
		this.context = context;
		//divide the string into tokens
		let tokens = [];
		let regexs = [/^[A-Za-z]+:[A-Za-z]+/, /^[A-Za-z]+/, /^((?:-?\d+(?:\.\d+)?\.\.(?:-?\d+(?:\.\d+)?)?)|(?:\.\.-?\d+(\.\d+)?))/, /^-?\d+(?:\.\d+)?/, /^={1,2}/, /^</, /^>/, /^<=/, /^>=/, /^&{1,2}/, /^\|{1,2}/, /^!/, /^\(/, /^\)/];
		{
			conditionExpressionSubstring = conditionExpression.replaceAll(" ", "");
			let tokenNames = [];
			let regexNames = ["variable", "variable", "range", "number", "equal", "less", "greater", "lessEqual", "greaterEqual", "and", "or", "not", "open", "close"];
			let valid = true
			tokenLoop: while (conditionExpressionSubstring.length) {
				for (let i = 0; i < 14; i++) {
					let r = regexs[i].exec(conditionExpressionSubstring)?.[0];
					if (r) {
						switch (i) {
							case 0:
							case 2:
							case 3:
								tokens.push(r);
								break;
							case 1:
								tokens.push(namespace + ":" + r);
								break;
							default:
								tokens.push(regexNames[i]);
								break;
						}
						tokenNames.push(regexNames[i]);
						conditionExpressionSubstring = conditionExpressionSubstring.substring(r.length);
						continue tokenLoop;
					}
				}
				valid = false;
				break;
			}
			if (!valid) {
				context.throwError("adventure", "Invalid token found!\nHere -> " + conditionExpressionSubstring);
			}
			//substitute ranges for inequalities
			const rangeUp = (e) => /^-?\d+(\.\d+)?\.\.$/.test(e), rangeDown = (e) => /^\.\.-?\d+(\.\d+)?$/.test(e), rangeContained = (e) => /^-?\d+(\.\d+)?\.\.-?\d+(\.\d+)?/.test(e);
			let i = tokens.findIndex(rangeUp);
			while (i != -1) {
				if (tokenNames[i - 2] != "variable" || tokenNames[i - 1] != "equal") {
					context.throwError("adventure", "invalid range syntax!");
				}
				let lower = tokens[i].substring(0, tokens[i].length - 2);
				tokens.splice(i - 2, 3, "open", tokens[i - 2], "greaterEqual", lower, "close");
				tokenNames.splice(i - 2, 3, "open", "variable", "greaterEqual", "number", "close");
				i = tokens.findIndex(rangeUp);
			}
			i = tokens.findIndex(rangeDown);
			while (i != -1) {
				if (tokenNames[i - 2] != "variable" || tokenNames[i - 1] != "equal") {
					context.throwError("adventure", "invalid range syntax!");
				}
				let upper = tokens[i].substring(2);
				tokens.splice(i - 2, 3, "open", tokens[i - 2], "lessEqual", upper, "close");
				tokenNames.splice(i - 2, 3, "open", "variable", "lessEqual", "number", "close");
				i = tokens.findIndex(rangeDown);
			}
			i = tokens.findIndex(rangeContained);
			while (i != -1) {
				if (tokenNames[i - 2] != "variable" || tokenNames[i - 1] != "equal") {
					context.throwError("adventure", "invalid range syntax!");
				}
				let [lower, upper] = tokens[i].split("..");
				tokens.splice(i - 2, 3, "open", tokens[i - 2], "greaterEqual", lower, "and", tokens[i - 2], "lessEqual", upper, "close");
				tokenNames.splice(i - 2, 3, "open", "variable", "greaterEqual", "number", "and", "variable", "lessEqual", "number", "close");
				i = tokens.findIndex(rangeContained);
			}
			//check for invalid comparisons, also convert number tokens to numbers while we're at it
			for (i = 0; i < tokens.length; i++) {
				switch (tokenNames[i]) {
					case "equal":
					case "less":
					case "greater":
					case "lessEqual":
					case "greaterEqual":
						if (!(tokenNames[i - 1] == "variable" || tokenNames[i - 1] == "number") || !(tokenNames[i + 1] == "variable" || tokenNames[i + 1] == "number")) {
							context.throwError("adventure", "invalid comparison operands!");
						}
						break;
					case "number":
						tokens[i] = Number(tokens[i]);
						break;
					default:
						break;
				}
			}
		}
		{
			//pair up the parenthesises
			let openIndex = tokens.lastIndexOf("open");
			while (openIndex != -1) {
				let closeIndex = tokens.indexOf("close", openIndex + 1);
				if (closeIndex == -1) {
					context.throwError("adventure", "Unpaired open parenthesises!");
				}
				tokens.splice(openIndex, closeIndex - openIndex + 1, tokens.slice(openIndex + 1, closeIndex));
				openIndex = tokens.lastIndexOf("open");
			}
			if (tokens.indexOf("close") !== -1) {
				context.throwError("adventure", "Unpaired closed parenthesises!");
			}
		}
		//convert to polish/prefix notation
		function polishify(tokenList) {
			//objects such as an array is always passed to a function by reference
			//by modifying the elements of the argument, we are modifying the original array

			//when we do this step doesn't matter, so we might as well do it now
			for (let i = 0; i < tokenList.length; i++) {
				if (tokenList[i] instanceof Array) {
					polishify(tokenList[i]);
				}
			}
			//variables, numbers, ranges, and not all have the highest priority
			//the not operator is already in front of its operand, so we don't have to touch it
			const precedents = ["equal", "less", "greater", "lessEqual", "greaterEqual", "and", "or"];
			for (let opIndex = 0; opIndex < 7; opIndex++) {
				let lowerPrecedents = [];
				if (opIndex <= 5) {
					lowerPrecedents.push("and");
				}
				if (opIndex <= 6) {
					lowerPrecedents.push("or");
				}
				const op = precedents[opIndex];
				let i = tokenList.indexOf(op);
				while (i != -1) {
					tokenList.splice(i, 1);
					let j = -1;
					if (lowerPrecedents.length >= 1) {
						//if lower precedence operator exists
						if (!(tokenList[i - 1] instanceof Array) && tokenList[i - 2] == "not") {
							j = i - 2;
						} else {
							j = i - 1;
							for (; j >= 0; j--) {
								//drag the operator left, until you hit a lower precendence or the beginning
								if (lowerPrecedents.includes(tokenList[j - 1])) {
									//bonk!
									j--;
									break;
								}
							}
						}
					}
					//place the operator
					tokenList.splice(j + 1, 0, op);
					i = tokenList.indexOf(op, i);
				}
			}
		}
		polishify(tokens);
		this.tokens = tokens.flat(Infinity);
	}

	evaluate() {
		//map all variable names to numbers
		for (let i = 0; i < tokens.length; i++) {
			if (regexs[0].exec(tokens[i]) != null) {
				let v = this.variables[tokens[i]];
				if (v == undefined) {
					throw new Error(`Variable ${tokens[i]} used before assignment.`);
				}
				tokens[i] = v;
			}
		}
		//now we have the expression in prefix notation, and can evaluate it with shortcircuiting!
		function nextCompleteExpression(index) {
			let counter = 1
			while (counter > 0) {
				index++;
				switch (tokens[index]) {
					case "equal":
					case "less":
					case "greater":
					case "lessEqual":
					case "greaterEqual":
					case "and":
					case "or":
						counter++;
						break;
					case "not":
						break;
					default:
						counter--;
						break;
				}
			}
			return index;
		}
		let stack = [0];
		let operations = [];
		let evaluation;
		while (stack.length >= 1) {
			let potentialShort = false;
			let i = stack.pop();
			switch (tokens[i]) {
				case "and":
				case "or":
					stack.push(nextCompleteExpression(i) + 1);
					stack.push(i + 1);
					operations.push(tokens[i]);
					break;
				case "not":
					stack.push(i + 1);
					operations.push("not");
					break;
				case "equal":
					{
						let a = tokens[i + 1];
						let b = tokens[i + 2];
						if (typeof a != "number" || typeof b != "number") {
							throw new Error("Bad ordering");
						}
						evaluation = a == b;
					}
					potentialShort = true;
					break;
				case "less":
					{
						let a = tokens[i + 1];
						let b = tokens[i + 2];
						if (typeof a != "number" || typeof b != "number") {
							throw new Error("Bad ordering");
						}
						evaluation = a < b;
					}
					potentialShort = true;
					break;
				case "greater":
					{
						let a = tokens[i + 1];
						let b = tokens[i + 2];
						if (typeof a != "number" || typeof b != "number") {
							throw new Error("Bad ordering");
						}
						evaluation = a > b;
					}
					potentialShort = true;
					break;
				case "lessEqual":
					{
						let a = tokens[i + 1];
						let b = tokens[i + 2];
						if (typeof a != "number" || typeof b != "number") {
							throw new Error("Bad ordering");
						}
						evaluation = a <= b;
					}
					potentialShort = true;
					break;
				case "greaterEqual":
					{
						let a = tokens[i + 1];
						let b = tokens[i + 2];
						if (typeof a != "number" || typeof b != "number") {
							throw new Error("Bad ordering");
						}
						evaluation = a >= b;
					}
					potentialShort = true;
					break;
			}
			while (potentialShort) {
				switch (operations.pop()) {
					case "not":
						evaluation = !evaluation;
						break;
					case "and":
						if (evaluation) {
							potentialShort = false;
						} else {
							stack.pop();
						}
						break;
					case "or":
						if (evaluation) {
							stack.pop();
						} else {
							potentialShort = false;
						}
						break;
					default:
						potentialShort = false;
						break;
				}
			}
		}
		return evaluation;
	}

}

class ContextMock {
	constructor() {
		this.errors = [];
	}

	throwError(type, message) {
		this.errors.push({ type, message });
	}
}

const testConditionals = (assert) => {
	console.log('Test 1: Simple range condition');
	{
		const variables = { 'test:x': 3, 'test:y': 12, 'test:z': 0 };
		const conditional = new Conditional('((x=4..7 && y=12..15) || z=1)', variables, 'test');

		const result = conditional.evaluate();

		assert.strictEqual(result, false, 'FAIL! Test 1: Simple range condition');
	}

	console.log('Test 2: Range condition with matching values');
	{
		const variables = { 'test:x': 5, 'test:y': 13, 'test:z': 0 };
		const conditional = new Conditional('((x=4..7 && y=12..15) || z=1)', variables, 'test');

		const result = conditional.evaluate();

		assert.strictEqual(result, true, 'FAIL! Test 2: Range condition with matching values');
	}

	console.log('Test 3: OR condition with true fallback');
	{
		const variables = { 'test:x': 8, 'test:y': 10, 'test:z': 1 };
		const conditional = new Conditional('((x=4..7 && y=12..15) || z=1)', variables, 'test');

		const result = conditional.evaluate();

		assert.strictEqual(result, true, 'FAIL! Test 3: OR condition with true fallback');
	}

	console.log('Test 4: Nested AND and OR conditions');
	{
		const variables = { 'test:a': 5, 'test:b': 3, 'test:c': 10 };
		const conditional = new Conditional('((a=4..6 && b=2..4) || c=10)', variables, 'test');
		const result = conditional.evaluate();

		assert.strictEqual(result, true, 'FAIL! Test 4: Nested AND and OR conditions');
	}

	console.log('Test 5: All conditions false');
	{
		const variables = { 'test:a': 2, 'test:b': 1, 'test:c': 0 };
		const conditional = new Conditional('((a=4..6 && b=2..4) || c=10)', variables, 'test');
		const result = conditional.evaluate();

		assert.strictEqual(result, false, 'FAIL! Test 5: All conditions false');
	}

	console.log('Test 6: Single equality check');
	{
		const variables = { 'test:x': 10 };
		const conditional = new Conditional('(x==10)', variables, 'test');
		const result = conditional.evaluate();

		assert.strictEqual(result, true, 'FAIL! Test 6: Single equality check');
	}

	console.log('Test 7: Single equality check, negative case');
	{
		const variables = { 'test:x': 5 };
		const conditional = new Conditional('(x==10)', variables, 'test');
		const result = conditional.evaluate();

		assert.strictEqual(result, false, 'FAIL! Test 7: Single equality check, negative case');
	}

	console.log('Test 8: Complex nested conditions');
	{
		const variables = { 'test:x': 5, 'test:y': 15, 'test:z': 1 };
		const conditional = new Conditional('((x=4..6 && (y=10..20 || z=2)) || z=1)', variables, 'test');
		const result = conditional.evaluate();

		assert.strictEqual(result, true, 'FAIL! Test 8: Complex nested conditions');
	}

	console.log('Test 9: Missing variable');
	{
		const variables = { 'test:x': 5 };
		const conditional = new Conditional('((x=4..6 && y=12..15) || z=1)', variables, 'test');

		assert.throws(
			() => conditional.evaluate(),
			/Variable test:y used before assignment/,
			'FAIL! Test 9: Missing variable'
		);
	}
};

const testActions = (assert) => {
	console.log('Test 1: Simple assignment'); {
		const variables = {};
		const context = new ContextMock();

		const action = new Action('a=10', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:a'], 10, 'FAIL! Test 1: Simple assignment');
	}

	console.log('Test 2: Zero assignment'); {
		const variables = {};
		const context = new ContextMock();

		const action = new Action('a=0', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:a'], 0, 'FAIL! Test 2: Zero assignment');
	}

	console.log('Test 3: Compound assignment with addition'); {
		const variables = { 'test:b': 5 };
		const context = new ContextMock();

		const action = new Action('b+=3', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:b'], 8, 'FAIL! Test 3: Compound assignment with addition');
	}

	console.log('Test 4: Expression evaluation with variables'); {
		const variables = { 'test:x': 2 };
		const context = new ContextMock();

		const action = new Action('y=x*3+1', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:y'], 7, 'FAIL! Test 4: Expression evaluation with variables');
	}

	console.log('Test 5: Expression evaluation with variables storing 0'); {
		const variables = { 'test:x': 0 };
		const context = new ContextMock();

		const action = new Action('y=x*3+7', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:y'], 7, 'FAIL! Test 5: Expression evaluation with variables storing 0');
	}

	console.log('Test 6: Division and subtraction'); {
		const variables = { 'test:z': 20 };
		const context = new ContextMock();

		const action = new Action('z/=4', variables, 'test', context);
		action.evaluate();

		assert.strictEqual(variables['test:z'], 5, 'FAIL! Test 6: Division and subtraction');
	}

	console.log('Test 7: Invalid action string'); {
		const context = new ContextMock();
		try {
			// noinspection ObjectAllocationIgnored
			new Action('invalid-action', {}, 'test', context);
		} catch (error) {
			assert.strictEqual(context.errors.length, 1, 'FAIL! Test 7: Invalid action string');
		}
	}

	console.log('Test 8: Expression with parentheses and precedence'); {
		const x = 4, variables = { 'test:x': x };
		const context = new ContextMock();

		const action = new Action('y=(7-2)*x+7', variables, 'test', context);
		action.evaluate();

		const expectedResult = (7 - 2) * x + 7;
		assert.strictEqual(variables['test:y'], expectedResult, 'FAI: Test 8: Expression with parentheses and precedence');
	}

	console.log('Test 9: Undefined variable'); {
		const variables = { undefinedVar: 7 };
		const context = new ContextMock();
		const action = new Action('c=undefinedVar+1', variables, 'test', context);

		try {
			action.evaluate();
		} catch (error) {
			assert.strictEqual(context.errors.length, 0, 'FAI: Test 9: Expression with parentheses and precedence');
		}
	}
};

// Test cases were generated using ChatGPT.
if (require.main === module) {
	const assert = require('assert');
	testActions(assert);
	testConditionals(assert);

	console.log("All tests passed!");
}


module.exports = {
	Action,
	Conditional,
	actionRegex,
	actionTokenRegex,
	conditionalTokenRegex,
	numberRangeRegex,
	numberRegex,
	variableRegex,
	whiteSpaceRegex,
	separatorRegex,
};
