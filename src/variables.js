
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
				.map((action) => action.replaceAll(' ','').trim())
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
	constructor(expression, variables, defaultNamespace, context) {
		this.evaluator = Conditional.createEvaluator(expression, variables, defaultNamespace, context);
	}

	evaluate() {
		return this.evaluator();
	}

	static createEvaluator(conditional, variables, defaultNamespace, context) {
		// Convert range expressions into logical conditions.
		const tokens = conditional
			.replace(whiteSpaceRegex, '')
			.replace(numberRangeRegex, (_, varName, start, end) =>
				`(${varName}>=${start}&&${varName}<=${end})`
			).match(conditionalTokenRegex);

		if (!tokens || !tokens.length) {
			context.throwError('adventure', 'Malformed conditional: ' + conditional);
		}

		const operators = {
			'&&': { precedence: 2, associativity: 'left', fn: (a, b) => a && b },
			'||': { precedence: 1, associativity: 'left', fn: (a, b) => a || b },
			'>=': { precedence: 3, associativity: 'left', fn: (a, b) => a >= b },
			'<=': { precedence: 3, associativity: 'left', fn: (a, b) => a <= b },
			'==': { precedence: 3, associativity: 'left', fn: (a, b) => a === b },
			'=':  { precedence: 3, associativity: 'left', fn: (a, b) => a === b },
		};

		// Convert infix to postfix using the Shunting-yard algorithm.
		const outputQueue = [];
		const operatorStack = [];

		for (const token of tokens) {
			if (numberRegex.test(token)) {
				outputQueue.push(Number(token));
			} else if (variableRegex.test(token)) {
				outputQueue.push('v' + Identifier.parse(token, defaultNamespace));
			} else if (operators[token]) {
				while (
					operatorStack.length &&
					operators[operatorStack[operatorStack.length - 1]] &&
					(
						(operators[token].associativity === 'left' &&
							operators[token].precedence <=
							operators[operatorStack[operatorStack.length - 1]].precedence) ||
						(operators[token].associativity === 'right' &&
							operators[token].precedence <
							operators[operatorStack[operatorStack.length - 1]].precedence)
					)
					) {
					outputQueue.push(operatorStack.pop());
				}
				operatorStack.push(token);
			} else if (token === '(') {
				operatorStack.push(token);
			} else if (token === ')') {
				while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
					outputQueue.push(operatorStack.pop());
				}
				operatorStack.pop(); // Remove '('
			}
		}

		while (operatorStack.length) {
			outputQueue.push(operatorStack.pop());
		}

		// Evaluate the postfix expression.
		return () => {
			const stack = [];
			for (const token of outputQueue) {
				if (typeof token === 'number') {
					stack.push(token);
				} else if (token.startsWith('v')) {
					const variableIdentifier = token.slice(1);
					if (variables[variableIdentifier] === undefined) {
						throw new Error(`Variable ${variableIdentifier} used before assignment.`);
					}
					stack.push(variables[variableIdentifier]);
				} else if (operators[token]) {
					const b = stack.pop();
					const a = stack.pop();
					stack.push(operators[token].fn(a, b));
				}
			}
			return Boolean(stack[0]);
		};
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

		const expectedResult = (7-2)*x+7;
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
