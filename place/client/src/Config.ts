
export enum SolanaNetwork {
    Localhost = "localhost",
    Testnet = "testnet",
    Devnet = "devnet",
    Mainnet = "mainnet-beta",
};

export type PlaceProgramVersion = {
    // Solana network this program version is deployed on
    network: SolanaNetwork,
    // Public key of the program as a base58 string
    programId: string,
    // Program semantic version number
    version: string,
};

export type PlaceRpcEndpoint = {
    // Name to display in UI for this endpoint
    // (i.e. GenesysGo, or Trident)
    name: string,
    // Solana network this RPC endpoint talks to
    network: SolanaNetwork,
    // RPC url
    url: string,
};

export const VERSIONS: PlaceProgramVersion[] = [
    {
        "network": SolanaNetwork.Localhost,
        "version": "0.1.0",
        "programId": "tapestry11111111111111111111111111111111111",
    },
    {
        "network": SolanaNetwork.Localhost,
        "version": "0.1.0",
        "programId": "52TAg9zW7QTf7cjkfgHzJ7EppByYgg3hYX2wFETMDPtB"
    },
    {
        "network": SolanaNetwork.Devnet,
        "version": "0.1.0",
        "programId": "dtpsyB2azmdEkZ6EBrzYxCrTaTp2j2JpgmtWsfbsgnr"
    },
];

export const ENDPOINTS: PlaceRpcEndpoint[] = [
    {
        "name": "localhost",
        "network": SolanaNetwork.Localhost,
        "url": "http://127.0.0.1:8899"
    },
    {
        "name": "Devnet (Solana)",
        "network": SolanaNetwork.Devnet,
        "url": "https://api.devnet.solana.com"
    },
];

// TODO(will): need to do some restructuring such that these can be set from UI
export const PLACE_VERSION = VERSIONS[2];
export const PLACE_ENDPOINT = ENDPOINTS[1];