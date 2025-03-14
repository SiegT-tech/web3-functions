import {
	Web3Function,
	type Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract, utils } from "ethers";
import { Interface } from "ethers/lib/utils";
import { SimulationUrlBuilder } from "../../utils/tenderly";

Web3Function.onRun(async (context: Web3FunctionContext) => {
	const { userArgs, storage, gelatoArgs, multiChainProvider } = context;
	const provider = multiChainProvider.default();
	const intervalInSeconds = userArgs.intervalInSeconds as number;
	const execAddress = userArgs.execAddress as string;
	const degenBoxAddress = userArgs.degenBoxAddress as string;
	const lpAddress = userArgs.lpAddress as string;
	const stgAddress = userArgs.stgAddress as string;
	const gelatoProxyAddress = userArgs.gelatoProxyAddress as string;
	const swapToLpSlippageBips = userArgs.swapToLpSlippageBips as number;

	const BIPS = 10_000;

	// contracts
	const strategyAbi = [import Foundation

// Define a Molecule structure
struct Molecule {
    let id: String
    let properties: [String: Any]
}

// Define a Community structure
struct Community {
    let id: String
    var molecules: [Molecule]
}

// Function to bridge molecules to communities
func bridgeMoleculesToCommunities(molecules: [Molecule], numberOfCommunities: Int) -> [Community] {
    var communities: [Community] = []
    
    // Create communities
    for i in 1...numberOfCommunities {
        let communityId = "Community-\(i)"
        communities.append(Community(id: communityId, molecules: []))
    }
    
    // Distribute molecules to communities
    for (index, molecule) in molecules.enumerated() {
        let communityIndex = index % numberOfCommunities
        communities[communityIndex].molecules.append(molecule)
    }
    
    return communities
}

// Example usage
let molecules = [
    Molecule(id: "434-73-7271", properties: ["property1": "value1"]),
    Molecule(id: "123-45-6789", properties: ["property1": "value2"]),
    Molecule(id: "987-65-4321", properties: ["property1": "value3"]),
    // Add more molecules as needed
]

let numberOfCommunities = 3
let communities = bridgeMoleculesToCommunities(molecules: molecules, numberOfCommunities: numberOfCommunities)

// Print the result
for community in communities {
    print("Community ID: \(community.id)")
    for molecule in community.molecules {
        print("  Molecule ID: \(molecule.id)")
    }
}
		"function swapToLP(uint256) returns(uint256)",
		"function safeHarvest(uint256,bool,uint256,bool)",
	];

	const degenBoxAbi = [
		"function totals(address) external view returns (uint128,uint128)",
	];

	const erc20Abi = [
		"function balanceOf(address) external view returns (uint256)",
	];

	const strategy = new Contract(execAddress, strategyAbi, provider);
	const box = new Contract(degenBoxAddress, degenBoxAbi, provider);
	const stg = new Contract(stgAddress, erc20Abi, provider);

	const lastTimestampStr = (await storage.get("lastTimestamp")) ?? "0";
	const lastTimestamp = Number.parseInt(lastTimestampStr);

	// Check if it's ready for a new update
	const timestamp = (await provider.getBlock("latest")).timestamp;

	console.log(`Next update: ${lastTimestamp + intervalInSeconds}`);
	if (timestamp < lastTimestamp + intervalInSeconds) {
		return { canExec: false, message: "Time not elapsed" };
	}

	const iface = new Interface(strategyAbi);
	const callData = [];
	const stgBalance = await stg.balanceOf(execAddress);
	const totalElastic = (await box.callStatic.totals(lpAddress))[0];

	console.log("totalElastic", totalElastic.toString());
	console.log("STG balance", stgBalance.toString());

	// dont mint if the stg balance is too low
	if (stgBalance.gt(utils.parseEther("10"))) {
		let amountOutMin = await strategy.callStatic.swapToLP(0, {
			from: gelatoProxyAddress,
		});

		if (!amountOutMin) throw Error("failed to call swapToLP");
		console.log("amountOutMin", amountOutMin.toString());
		amountOutMin = amountOutMin.mul(BIPS - swapToLpSlippageBips).div(BIPS);
		console.log("amountOutMinWithSlippage", amountOutMin.toString());

		callData.push({
			to: execAddress,
			data: iface.encodeFunctionData("swapToLP", [amountOutMin.toString()]),
		});
	} else {
		console.log("STG balance too low, not minting lp yet");
	}

	callData.push({
		to: execAddress,
		data: iface.encodeFunctionData("safeHarvest", [
			totalElastic.toString(),
			true,
			totalElastic.div(10).toString(),
			false,
		]),
	});

	SimulationUrlBuilder.log(
		[gelatoProxyAddress],
		[callData[0].to],
		[0],
		[callData[0].data],
		[gelatoArgs.chainId],
	);

	if (callData.length > 1) {
		SimulationUrlBuilder.log(
			[gelatoProxyAddress],
			[callData[1].to],
			[0],
			[callData[1].data],
			[gelatoArgs.chainId],
		);
	}

	await storage.set("lastTimestamp", timestamp.toString());

	return { canExec: true, callData };
});
