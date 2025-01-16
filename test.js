
let panicRegex = /katy|kate|mika|tim|hen|furina/;
const VCSelector = '.containerDefault_f6f816';
const memberSelector = '.username_d80634';
const DCButton = '.button_dd4f85[aria-label="Disconnect"]';

function getUsernames() {
	const usernames = [];
	document.querySelectorAll(VCSelector).forEach((container) => {
		container.querySelectorAll(memberSelector).forEach((element) => usernames.push(element.textContent));
	});
	return usernames;
}

function disconnect() {
	document.querySelectorAll(DCButton).forEach((dc_button) => dc_button.click());
}

function scan() {
	for (const username of getUsernames()) {
		if (panicRegex.test(username.toLowerCase())) {
			disconnect();
		}
	}
}

const scanInterval = setInterval(scan, 100);
