
const farmer = require("./farmer.js")
const vec3 = require('vec3');
const fs = require('node:fs');

const BED_TIME = 12000;

//let cropType = 'wheat_seeds'
//let seedName = 'wheat_seeds';
//let harvestName = 'wheat';
let cropType = 'carrot'
let seedName = 'carrot';
let harvestName = 'carrots';

let expansion = 0;
let snackTime = false;

const bot = farmer.createFarmerBot({
	username: "Vasja",
	host: "localhost",
	port: 61338,
	//viewDistance: "tiny",
});

// let bedPosition;
// let chestPosition;
// let mcData;

bot.on('kicked', (reason, loggedIn) => bot.log(reason, loggedIn));
bot.on('error', err => bot.log(err));

bot.once('spawn', async () => {
	//const defaultMove = new Movements(bot);

	//mcData = require('minecraft-data')(bot.version);
	bot.talk(`Привет! Я фермер! Ща заебашу тебе тут огородик!`);

	// let farmBlocks = bot.findBlock({
	// 	matching: (block) => {
	// 		return block.name === "farmland";
	// 	},
	// 	maxDistance: 64,
	// });

	// if (!farmBlocks) {
	// 	bot.log("Waiting for command to start.");
	// 	return;
	// }

	//bot.log(bot.registry.blocksByName);
	// fs.writeFile("debug/blocksByName.json", JSON.stringify(bot.registry.blocksByName), function(err) {
	// 	if(err) {
	// 		return bot.log(err);
	// 	}
	// }); 
	// fs.writeFile("debug/itemsByName.json", JSON.stringify(bot.registry.itemsByName), function(err) {
	// 	if(err) {
	// 		return bot.log(err);
	// 	}
	// }); 
	// fs.writeFile("debug/mcData.json", JSON.stringify(mcData), function(err) {
	// 	if(err) {
	// 		return bot.log(err);
	// 	}
	// }); 

	bot.log("Entering main loop.");
	mainLoop();
});

bot.on('chat', async (username, message) => {
	let tokens = message.split(' ');

	bot.log(`received the message: ${message}`);

	switch (tokens[0]) {
		case 'sayItems':
			bot.sayItems();
			break;
		case 'bed':
			bedPosition = vec3(parseInt(tokens[1]), parseInt(tokens[2]), parseInt(tokens[3]));
			break;
		case 'chest':
			chestPosition = vec3(parseInt(tokens[1]), parseInt(tokens[2], parseInt(tokens[3])));
			break;
		case 'eat':
			snackTime = true;//takeSnackBreak();
			break;
		case 'expand':
			if (tokens.length === 1) {
				expansion += 1;
			} else {
				let loops = parseInt(tokens[1]);
				expansion += loops;
				bot.talk(`expanding to ${expansion}`)
			}
			break;
		case 'hoe':
			getHoe();
			break;
		case 'seeds':
			for (let i = 0; i < 10; i++) {
				await getSeeds();
			}
			break;
		case 'start':
			bot.log("Starting a new farm. Wish me luck!");
			await startFarm();
			mainLoop();
			break;
	}
});

async function mainLoop() {
	i = 0;
	while (true) {
		bot.log(" ");
		bot.log(`mainLoop iteration ${i++}`);

		//bot.log(`mainLoop iteration ${i++}, free slots: ${bot.numFreeSlots()} busy slots: ${bot.numBuzySlots()}`);

		// bot.log(" ");
		// bot.log(bot.inventory);
		
		// bot.log(" ");
		// bot.log(bot.inventory.slots);

		if (bot.time.timeOfDay > BED_TIME) await sleepInBed();
		if (bot.numFreeSlots() < 33) await depositLoop();
		if (bot.food <= 10 || snackTime) await takeSnackBreak();

		await collectNearestItems(4);

		await harvestCrops();

		await fillFarmland();

		if (expansion) {
			await expandFarm();
			expansion -= 1;
		}

		bot.log("waitForTicks 64 ...");
		await bot.waitForTicks(64);
	}
}

const sideVectors = [
	[0, 0, 1],
	[0, 0, -1],
	[1, 0, 0],
	[-1, 0, 0],

	[0, 1, 1],
	[0, 1, -1],
	[1, 1, 0],
	[-1, 1, 0],

	[0, -1, 1],
	[0, -1, -1],
	[1, -1, 0],
	[-1, -1, 0],
];

function checkValidOpen(block) {
	if (!block) return false;
	if (block.name === "farmland") return false;
	if (block.name !== "dirt" && block.name !== "grass_block") return false;

	let topBlock = bot.blockAt(block.position.offset(0, 1, 0));

	if (topBlock.name !== "air" && topBlock.name !== "cave_air") return false;

	return true;
}

async function findEdges() {
	let farmBlocks = await bot.findBlocks({
		matching: (block) => {
			return block.name === "farmland";
		},
		count: 256,
		maxDistance: 32,
	});

	let openList = [];

	for (block of farmBlocks) {
		for (side of sideVectors) {
			let sideBlock = bot.blockAt(block.offset(...side));

			if (sideBlock && checkValidOpen(sideBlock)) {
				openList.push(sideBlock.position);
			}
		}
	}

	return openList;
}

async function expandFarm() {
	bot.log("Go Expand Farm ...");

	let openList = await findEdges();
	bot.log(`openList:${openList}`);

	while (openList.length > 0) {
		let position = openList.reduce((best, item) => {
			if (!best) return item;
			return item.distanceTo(bot.entity.position) < best.distanceTo(bot.entity.position) ? item : best;
		}, null);

		let index = openList.indexOf(position);
		openList.splice(index, 1);

		if (!checkInventory("wooden_hoe")) await getHoe();
		if (!bot.heldItem || bot.heldItem.name != "wooden_hoe") await bot.equip(bot.registry.itemsByName["wooden_hoe"].id);

		await bot.goToPos(position);

		let dirt = bot.blockAt(position);
		//bot.talk("expand farm");
		await bot.activateBlock(dirt, vec3(0, 1, 0)).catch(console.error);

		await bot.waitForTicks(1);

		// Plant seeds on dirt
		if (!checkInventory("wheat_seeds")) await getSeeds();
		if (!bot.heldItem || bot.heldItem.name !== seedName) await bot.equip(bot.registry.itemsByName[seedName].id).catch(console.error);

		await bot.goToPos(position);
		//bot.talk("expand farm 2");
		await bot.activateBlock(dirt, vec3(0, 1, 0)).catch(console.error);
	}

	bot.talk("Edges!");
	expansion = 0;
}

function checkInventory(itemName) {
	let items = bot.inventory.items();
	return items.filter(item => item.name === itemName).length;
}

async function getSeeds() {
	if (checkInventory(seedName) >= 1) return;

	while (true) {
		let grassBlock = bot.findBlock({
			matching: block => {
				if (block.name === harvestName && block.metadata === 7) return true;
				return block.name === "grass" || block.name === "tall_grass";
			},
			maxDistance: 64
		});

		if (!grassBlock) {
			bot.log("Couldn't find grass.");
			return;
		}

		await bot.goToPos(grassBlock.position, 1.5);

		await bot.dig(grassBlock);

		bot.waitForTicks(1);

		// Look for an item entity with ID of 619 (wheat_seeds)
		let itemEntity = bot.nearestEntity((entity) => {
			//bot.log(entity);
			//return entity.name === 'item' && entity.metadata[7] && entity.metadata[7].itemId === 619;
			return entity.name === 'item' && entity.metadata[7] && entity.metadata[7].itemId === 383; // carrots
		});

		if (!itemEntity) continue;

		await bot.goToPos(itemEntity.position);
		await bot.waitForTicks(1);

		if (checkInventory(seedName)) {
			bot.log("Found seeds.");
			return;
		}
	}
}


async function getWood(amount = 1) {
	const logsList = [
		bot.registry.itemsByName["oak_log"].id,
		bot.registry.itemsByName["dark_oak_log"].id,
		bot.registry.itemsByName["birch_log"].id
	];

	let woodBlocks = bot.findBlocks({
		matching: block => {
			return block.name === "oak_log";
		},
		count: amount,
		maxDistance: 64,
	});

	if (!woodBlocks.length) {
		bot.log("Couldn't find a tree.");
		return;
	}

	for (woodPosition of woodBlocks) {
		let woodBlock = bot.blockAt(woodPosition);
		await bot.goToPos(vec3(woodPosition.x, bot.entity.position.y, woodPosition.z));

		await bot.dig(woodBlock);

		await bot.waitForTicks(1);

		let itemEntity = bot.nearestEntity((entity) => {
			return entity.name === 'item' && entity.entityType === bot.registry.itemsByName["oak_log"].id;
		});

		if (!itemEntity || bot.entity.position.distanceTo(itemEntity.position) > 5) continue;

		bot.log(`Item found at ${vec3(itemEntity.position.x, bot.entity.position.y, itemEntity.position.z)
			}!`);

		await bot.waitForTicks(10); // I don't know if this'll help.

		await bot.goToPos(vec3(itemEntity.position.x, bot.entity.position.y, itemEntity.position.z), 1);
		await bot.waitForTicks(1);
	}
}

async function craftHoe() {
	let hoe_id = bot.registry.itemsByName['wooden_hoe'].id;

	let table = bot.findBlock({
		matching: (block) => {
			return block.name === "crafting_table";
		},
		maxDistance: 4,
	});

	if (!table) {
		bot.log("Couldn't find a table.");
		return;
	}

	let recipe = bot.recipesFor(hoe_id, null, 1, table)[0];

	if (!recipe) {
		bot.log("Couldn't find a recipe.");
		return;
	}

	await bot.craft(recipe, 1, table);

	bot.log("Made hoe.");
}

async function getHoe() {
	let planksID = bot.registry.itemsByName['oak_planks'].id;
	let stickID = bot.registry.itemsByName['stick'].id;
	let tableID = bot.registry.itemsByName['crafting_table'].id;
	let hoeID = bot.registry.itemsByName['wooden_hoe'].id;

	await getWood(4);

	bot.log("Found wood!");

	// Craft wooden planks.
	let planksRecipes = bot.recipesFor(planksID, null, 1, null);
	bot.log(planksRecipes);
	if (!planksRecipes || !planksRecipes) {
		comsole.err(`no planksRecipes`);
		return;
	}
	await bot.craft(planksRecipes[0], 3, null);

	bot.log("Crafted planks!");

	// Craft sticks.
	let stickRecipes = bot.recipesFor(stickID, null, 1, null);
	bot.log(stickRecipes);
	await bot.craft(stickRecipes[0], 1, null);

	bot.log("Crafted sticks!");

	// Craft crafting table.
	let tableRecipes = bot.recipesFor(tableID, null, 1, null);
	await bot.craft(tableRecipes[0], 1, null);

	bot.log("Made a table!");

	// Find somewhere to put the crafting table.
	let solidBlocks = bot.findBlocks({
		matching: (block) => {
			return block.name !== "air" && block.name !== "cave_air";
		},
		count: 64,
		maxDistance: 10,
	});

	let craftingSpot;

	for (position of solidBlocks) {
		let block = bot.blockAt(position);
		let topBlock = bot.blockAt(block.position.offset(0, 1, 0));

		if (topBlock.name !== "air" && topBlock.name !== "cave_air") continue;
		if (bot.entity.position.xzDistanceTo(position) <= 2) continue;

		craftingSpot = block;
		break;
	}

	// Place the crafting table.
	if (!craftingSpot) bot.log("Couldn't find somewhere to put the crafting table.");

	let tablePosition = craftingSpot.position;

	await bot.equip(bot.registry.itemsByName["crafting_table"].id);
	await bot.goToPos(tablePosition, 4);
	await bot.placeBlock(craftingSpot, { x: 0, y: 1, z: 0 }).catch(console.error);

	bot.log("Placed the table! (maybe)");

	await bot.waitForTicks(1);

	await craftHoe();
	await bot.waitForTicks(1);
	await bot.equip(hoeID);
	bot.log("Equiped the hoe!");
}

async function sleepInBed() {
	if (bot.isSleeping)
		return;

	bot.log("finding bed ...");

	try {
		let bed = bot.findBlock({
			matching: block => bot.isABed(block),
			maxDistance: 64
		});
	
		if (!bed) {
			bot.log("Couldn't find bed.");
			return;
		}
	
		const reached = await bot.goToPos(bed.position);
		if (reached) {
			await bot.sleep(bed);
		} else {
			console.warn(`bed is unreachable`);
		}
	}
	catch (e) {
		console.error(`sleepInBed failed: ${e}`);
	}
}

async function depositLoop() {
	bot.log("finding chest ...");

	try {
		const chestBlocksPos = bot.findBlocks({
		matching: bot.registry.blocksByName['chest'].id,
			count: 16,
			maxDistance: 16,
	});

		if (chestBlocksPos.length === 0) {
		bot.log("Couldn't find chest.");
		return;
	}

		for (const chestBlockPos of chestBlocksPos) {
			const reached = await bot.goToPos(chestBlockPos);
			if (!reached) {
				continue;
			}
	
			bot.lookAt(chestBlockPos);
			let chestBlock = bot.blockAt(chestBlockPos);
	
			let chestView = await bot.openChest(chestBlock);
			const numAvailableSlots = chestView.slots.filter(v => v == null).length;
			if (numAvailableSlots == 0)
				continue;
	
			let depositOk = false;
		deposittedTries = 0
		for (slot of bot.inventory.slots) {
				for (let vegetable of bot.vegetables) {
					if (slot && slot.name == vegetable.cropType) {
				try {
							await chestView.deposit(slot.type, null, slot.count);
					bot.log(`deposited ${slot.count} ${slot.name}`);
							bot.talk(`Сложил ${slot.count} ${slot.name}`);
				} catch (err) {
					console.warn(`unable to deposit ${slot.count} ${slot.name} because ${err}`);
							//bot.talk(`Не могу сложить ${slot.count} ${slot.name}: ${err}`);
							depositOk = false;
						}
				}
				if(deposittedTries++ > 18)
					break;
			}
		}

		bot.log("close chest ...");
			chestView.close();

			if (!depositOk) {
				continue;
			}
	
			break;
		}
	} catch (e) {
		console.error(e);
	}
}

async function collectNearestItems(numItemsToCollect=4) {
	await bot.collectNearestItems(numItemsToCollect);
}

async function harvestCrops() {
	bot.log("finding ready to crop ...");

	try {
		let harvest = bot.findReadyToCrop();

		if (!harvest) {
			bot.log("couldn't find harvest.");
			return;
		}
		//bot.log(harvest);

		let reached = await bot.goToPos(harvest.position);
		if (!reached) {
			console.warn(`harvest not reachable`);
			return;
		}

		bot.talk(`harvest ${harvest.name} at ${harvest.position}`);
		await bot.dig(harvest);

		await bot.waitForTicks(5);

		await bot.collectNearestItems();

		if (!bot.heldItem || bot.heldItem.name != seedName) {
			await getSeeds();
			await bot.equip(bot.registry.itemsByName[seedName].id);
		}

		await bot.waitForTicks(5);

		let plantPos = harvest.position.offset(0, -1, 0);
		let dirt = bot.blockAt(plantPos);
		bot.talk(`plant ${bot.heldItem.name} at ${plantPos}`);
		await bot.activateBlock(dirt, vec3(0, 1, 0)).catch(console.error);
	}
	catch (e) {
		console.error(e);
	}
}

async function fillFarmland() {
	bot.log("finding vacant farmland ...");

	try {
		let blockToFarm = bot.findVacantFarmlandBlock();
		if (!blockToFarm) {
			console.warn("couldn't find vacant farmland.");
			return;
		}

		bot.log("vacant found");

		const reached = await bot.goToPos(blockToFarm.position);
		if (!reached) {
			console.warn(`vacant not reachable`);
			return;
		}

		if (!bot.heldItem || bot.heldItem.name != seedName) {
			const seed = bot.inventory.items().find(item => item.name.includes(seedName))
			if (seed) {
				bot.log(`equip ${seedName}`);
				//bot.log(`equip is ${bot.registry.itemsByName[seedName].id}`);
				await bot.equip(bot.registry.itemsByName[seedName].id);
			}
			else {
				bot.talk('no items to fill farmland');
				return;
			}
		}

		bot.log(`fill farmland by ${bot.heldItem.name} at ${blockToFarm.position} ${blockToFarm.name}`);
		bot.talk(`fill farmland by ${bot.heldItem.name} at ${blockToFarm.position} ${blockToFarm.name}`);
		await bot.activateBlock(blockToFarm, vec3(0, 1, 0)).catch(console.error);

	} catch (e) {
		console.error(e)
	}
}

async function takeSnackBreak() {
	try {
	snackTime = false;

	bot.log("finding crafting_table ...");

	let table = bot.findBlock({
		matching: (block) => {
			return block.name === "crafting_table";
		},
		maxDistance: 32,
	});

	let ate = false;

	if (table) {

		let bread_id = bot.registry.itemsByName['bread'].id;

		bot.log("goto crafting_table ...");
		const reached = await bot.goToPos(table.position);
		if (reached) {
			await bot.sleep(bed);
		} else {
			console.warn(`crafting_table is unreachable`);
		}

		let recipe = bot.recipesFor(bread_id, null, 1, table)[0];

		if (!recipe) {
			bot.log("Couldn't find a recipe.");
		}
		else {
			await bot.craft(recipe, 1, table);

			bot.log("Made bread.");

			if (bot.food === 20) {
				bot.log(`Too full to eat.`);
				return;
			}

			bot.log(`equip ${bread_id}`);
			await bot.equip(bread_id);
			await bot.consume();

			bot.log("Ate bread.");
				bot.talk("Поел хлеба");
			ate = true;
		}
	}

	if (!ate) {
		let carrot_id = bot.registry.itemsByName['carrot'].id;
		bot.log(`equip ${carrot_id}`);
		await bot.equip(carrot_id);
		await bot.consume();
		bot.log("Ate carrot.");
			bot.talk("Поел морковки");
		}
	} catch (e) {
		console.error(e);
	}
}

async function startFarm() {
	let blocks = bot.findBlocks({
		matching: (block) => {
			return block.name === "grass_block" || block.name === "dirt";
		},
		count: 256,
		maxDistance: 20,
	});

	bot.log(`Total blocks found: ${blocks.length}`);

	let farmPosition = blocks.find((position) => {

		if (bot.entity.position.distanceTo(position) < 2) return false;

		let topBlock = bot.blockAt(position.offset(0, 1, 0));
		if (topBlock.name !== 'air') return false;

		let topestBlock = bot.blockAt(position.offset(0, 2, 0));
		if (topestBlock.name !== 'air') return false;

		return true;
	});

	if (!farmPosition) return false;
	bot.log(`Bot: ${bot.entity.position}`);
	bot.log(`Farm: ${farmPosition}`);

	if (!checkInventory("wooden_hoe")) await getHoe();
	if (!bot.heldItem || bot.heldItem.name != "wooden_hoe") await bot.equip(bot.registry.itemsByName["wooden_hoe"].id);

	await bot.goToPos(farmPosition);

	bot.talk("start farm");
	let dirt = bot.blockAt(farmPosition);
	await bot.activateBlock(dirt, vec3(0, 1, 0)).catch(console.error);

	await bot.waitForTicks(1);

	// Plant seeds on dirt
	if (!checkInventory("wheat_seeds")) await getSeeds();
	if (!bot.heldItem || bot.heldItem.name !== seedName) await bot.equip(bot.registry.itemsByName[seedName].id).catch(console.error);

	await bot.goToPos(farmPosition);
	bot.talk("start farm 2");
	await bot.activateBlock(dirt, vec3(0, 1, 0)).catch(console.error);

	return true;

}