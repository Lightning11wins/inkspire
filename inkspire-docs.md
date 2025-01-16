# Inkspire Format
\* indicates that a field is required.

## Adventures
An adventure is a JSON object. Adventures are typically written in their own `.json` files, which can be loaded by the game. There is currently no way to write multiple adventures in the same file. Adventures have the following fields:
- **title\*** : `text` The title of the adventure.
- **name\*** : `namespace` The internal name of the adventure, used for internal identification. Cannot contain colons. Contains only lowercase ascii letters and underscores, by convention.
- **author** : `text` The name of the author of this story. This name is conventionally only upper or lower case ascii characters.
- **version\*** : `int` The format version that this adventure was written to use. Currently, the only version is 1.
- **requires** : `string` A comma separated list of other adventures that are required to be loaded for this adventure. If your adventure references a namespace other than Inkspire, it's highly recommended that you require that adventure to avoid a linking error, which occurs when that namespace does not exist.
- **actions** : `action` Actions that run when the adventure is loaded. It is recommended that you use these to set initial values for every variable used in the adventure to avoid undefined behavior.
- **globalTop** : `text` Specifies content that appears above the content of every scene in the adventure, but below the title.
- **globalBottom** : `text` Specifies content that appears below the content of every scene in the adventure, above the options.
- **startingScene** : `identifier` The identifier of the scene where new players start when entering this adventure for the first time. Specifying a starting-scene in another namespace (aka. starting your adventure in a different adventure) is allowed. Defaults to `start` if unspecified.
- **scenes\*** : `scene[]` An array of scenes that make up this adventure.

## Scenes
A scene is a JSON object which includes the following fields:
- **title\*** : `text` The title of the scene.
- **name\*** : `name` The internal name of the scene, used for internal identification. Cannot contain colons. Contains only lowercase ascii letters, by convention.
- **actions** `action` Actions which occur every time the user enters this scene.
- **content\*** : `text[]` The text paragraphs displayed during the scene, describing what happens around the player. Each string represents one paragraph.
- **options\*** : `option[]` The possible choices that the player can select to continue the adventure.

## Options
An option is a JSON object which includes the following fields:
- **label\*** : `text` The text shown to the user for this option.
- **target\*** : `identifier` The identifier for the scene to which the player is sent after clicking this option.
- **condition** : `condition` A condition that must be met for this option to be selectable. If none is specified, the option is always selectable.
- **alwaysVisible** : `bool` Whether to show the option, even when it isn't selectable. Defaults to `false`, if unspecified.
- **actions** `action` Actions which occur every time the user selects this option.

## Identifiers, Namespaces, & Names
Identifiers are a namespace and a name string in the form `namespace:name`. They are used to uniquely distinguish variables and values. For example, in an adventure named "palace", the "kitchen" scene has the identifier `palace:kitchen`. In many cases, specifying the full identifier is necessary. For example, within the `palace` adventure, the kitchen may be referred to without a namespace as simply `kitchen`, and the current adventure's namespace will be used as a default.

## Conditions
A condition is a string which evaluates to either `true` or `false` at any given time during the adventure.
- **variable=min..max** Evaluates to true if the specified variable is within the specified floating-point range. (e.g. 0.1 - exact match of 0.1. ..0.1 - less than or equal to 0.1. 0.1.. - more than or equal to 0.1. 0.1..1 - from 0.1 to 1, both inclusive.)
- **condition || condition** Evaluates to true if either condition is true. Using a single pipe (`|`) is also valid, but cool people use `||`.
- **condition && condition** Evaluates to true if both conditions are true. Using a single ampersand (`&`) is also valid, but cool people use `&&`.

## Actions
An action is a string specifying changes to the variables stored for each user. They are written in the form of a variable followed by an expression. Valid operations include `=`, ` +=`, `-=`, `*=`, and `/=`. For example, if damage is 2 and strength is 1, then `health -= damage + strength` subtracts 3 from health. Note that variables from other stories need to be identified with a namespace, for example `inkspire:time`.

## Basic Types
It's assumed that the user understands most basic programming types, but they are explained in minimal detail here:
- **bool** Either `true` or `false` (conventionally not capitalized).
- **string** A sequence of characters.
- **text** A string, but with some additional features that are rerendered each time the string is displayed:
  - `${variable}` Include variables in text. It is recommended to set default values for all variables which appear in text since this standard does not define a value that should appear if an undefined variable is displayed.
  - `?{condition?text1|text2}` Display text only if a condition is true. In this example, text1 displays when the condition is met, and text2 displays when it is not. Including the pipe (`|`), followed by text2, is optional, and defaults to no text being displayed on a false condition.
However, you can opt to use a `condition` instead, which will be reevaluated each time the relevant content is displayed.


# Inkspire Namespace
The Inkspire namespace provides several useful scenes and variables to help you bring your adventures to life.

## Inkspire Scenes
- **inkspire:switch** Allows players to switch to a new adventure.
- **inkspire:fail** Marks the adventure as failed.
- **inkspire:pass** Marks the adventure as completed successfully.
- **inkspire:exit** Closes the game.
- **inkspire:back** Goes to the player's previous page.

[//]: # ( I am hereby scrapping this part of the spec because it's too hard to implement. I'll do this later, if I can figure it out.)
[//]: # (  - **depth** : `int` The number of rooms to go back.)
[//]: # (  - **to** : `string` Goes back until reaching a room with this namespace.)

## Inkspire Variables
- **inkspire:failures** The number of adventures this player has completed.
  - **author** : `string` Filter only completions of stories by a specific author. Note that this is case-sensitive.
- **inkspire:completions** The number of adventures this player has completed.
  - **author** : `string` Filter only completions of stories by a specific author. Note that this is case-sensitive.
- **inkspire:undefined** Provides the `undefined` value. Using this is not recommended in most situations, since all variables should have defined values to avoid undefined or inconsistent behavior.
- **inkspire:time** The seconds since January 1, 1970.

### Examples
`inkspire:back[depth=2,to="inkspire"]` Goes back two rooms, then continues going back until reaching a room in the inkspire namespace.
