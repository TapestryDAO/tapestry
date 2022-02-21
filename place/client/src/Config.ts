export enum SolanaNetwork {
    Localhost = "localhost",
    Testnet = "testnet",
    Devnet = "devnet",
    Mainnet = "mainnet-beta",
}

export type PlaceProgramVersion = {
    // Solana network this program version is deployed on
    network: SolanaNetwork;
    // Public key of the program as a base58 string
    programId: string;
    // Program semantic version number
    version: string;
};

export type PlaceRpcEndpoint = {
    // Name to display in UI for this endpoint
    // (i.e. GenesysGo, or Trident)
    name: string;
    // Solana network this RPC endpoint talks to
    network: SolanaNetwork;
    // RPC url
    url: string;
};

export const VERSIONS: PlaceProgramVersion[] = [
    {
        network: SolanaNetwork.Localhost,
        version: "0.1.0",
        programId: "tapestry11111111111111111111111111111111111",
    },
    {
        network: SolanaNetwork.Localhost,
        version: "0.1.0",
        programId: "52TAg9zW7QTf7cjkfgHzJ7EppByYgg3hYX2wFETMDPtB",
    },
    {
        network: SolanaNetwork.Devnet,
        version: "0.1.0",
        programId: "dtpsyB2azmdEkZ6EBrzYxCrTaTp2j2JpgmtWsfbsgnr",
    },
];

export const ENDPOINTS: PlaceRpcEndpoint[] = [
    {
        name: "localhost",
        network: SolanaNetwork.Localhost,
        url: "http://127.0.0.1:8899",
    },
    {
        name: "Devnet (Solana)",
        network: SolanaNetwork.Devnet,
        url: "https://api.devnet.solana.com",
    },
];

// NOTE(will): I haven't wrapped my head around deployment 100% but in a nutshell:
// 1. it is possible to have the same program ID deployed to different networks
// 2. it is possible to have different versions of the program deployed under different ID's on the same network
// 3. it is possible to have different RPC endpoints for the same network, and we will likely want users
// to be able to toggle between these in the UI. (i.e if GenesysGo is shitting the bed for some reason, allow
// user to switch to trident)

export const findEndpoints = (
    network: SolanaNetwork | string,
    name: string | null = null
): PlaceRpcEndpoint => {
    let filteredEndpoints: PlaceRpcEndpoint[] = [];
    let networkTyped = typeof network === "string" ? (network as SolanaNetwork) : network;
    for (let endpoint of ENDPOINTS) {
        let matchesNetwork = endpoint.network === networkTyped;
        let matchesName = name === null ? true : endpoint.name === name;
        if (matchesNetwork && matchesName) {
            filteredEndpoints.push(endpoint);
        }
    }

    return filteredEndpoints[0];
};

export const findProgramVersion = (
    network: SolanaNetwork | string,
    programId: string
): PlaceProgramVersion => {
    let filteredPrograms: PlaceProgramVersion[] = [];
    let networkTyped = typeof network === "string" ? (network as SolanaNetwork) : network;
    for (let version of VERSIONS) {
        let matchesNetwork = version.network === networkTyped;
        let matchesProgramId = programId === version.programId;
        if (matchesNetwork && matchesProgramId) {
            filteredPrograms.push(version);
        }
    }

    return filteredPrograms[0];
};

// TODO(will): need to do some restructuring such that these can be set from UI
export const PLACE_VERSION = VERSIONS[0];
export const PLACE_ENDPOINT = ENDPOINTS[0];
