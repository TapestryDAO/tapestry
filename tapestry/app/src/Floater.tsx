import React, { FC, useEffect, useState } from "react";
import {
    Container,
    Box,
    createTheme,
    Button,
    ButtonGroup,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Typography,
    Divider,
} from "@mui/material";
import { TapestryChunk, TapestryClient, TokenAccountsCache } from "@tapestrydao/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { borderColor } from "@mui/system";

const theme = createTheme({});

const FloaterContainerSx = {
    bgcolor: "#FFF",
    top: 100,
    left: 20,
    bottom: 20,
    boxShadow: 1,
    borderRadius: 2,
    position: "absolute",
    width: 400,
};

enum MenuState {
    MyPatches,
    Featured,
    ForSale,
}

type MyPatchListItemProps = {
    chunk: TapestryChunk;
};

export const MyPatchListItem: FC<MyPatchListItemProps> = ({ chunk }) => {
    // useEffect(() => {
    //     for (let row of chunk.chunkAccounts) {
    //         row[0]?.image_bitmap
    //     }
    // }, [chunk])

    // 2D array of image elements
    let imgs = [];

    let key = 0;

    for (let row of chunk.chunkAccounts) {
        let rowImgs = [];

        const pushEmpty = () => {
            rowImgs.push(
                <img key={"" + key} style={{ margin: 0, padding: 0, width: 10, height: 10 }}></img>
            );
            key += 1;
        };

        for (let item of row) {
            if (item === null || item === undefined) {
                pushEmpty();
                continue;
            }
            let data = item.data;
            if (data === undefined) {
                pushEmpty();
                continue;
            }
            let img_data = data.image_data;
            if (img_data === undefined) {
                pushEmpty();
                continue;
            }

            let imgStrData = "data:image/gif;base64," + img_data.toString("base64");
            rowImgs.push(
                <img
                    key={"" + key}
                    style={{
                        border: "1px solid red",
                        margin: 0,
                        padding: 0,
                        width: 10,
                        height: 10,
                    }}
                    src={imgStrData}
                ></img>
            );
            key += 1;
        }
        imgs.push(rowImgs);
    }

    return (
        <ListItem alignItems="flex-start" sx={{ margin: 0, padding: 0, height: 90 }}>
            <Box sx={{ height: 80, padding: "0", margin: "0" }}>
                {imgs.map((row) => {
                    return (
                        <div style={{ height: 10, width: 80, padding: 0, margin: "0" }}> {row}</div>
                    );
                })}
            </Box>
            <Box justifyContent="center">
                <Typography type="h2">
                    Chunk {chunk.xChunk},{chunk.yChunk}
                </Typography>
            </Box>
        </ListItem>
    );
};

export const MyPatches: FC = () => {
    const { publicKey } = useWallet();

    const [userOwnedChunks, setUserOwnedChunks] = useState<TapestryChunk[] | null>(null);

    useEffect(() => {
        let tapClient = TapestryClient.getInstance();

        if (publicKey === null || publicKey === undefined) {
            setUserOwnedChunks(null);
        } else {
            let userChunks = tapClient.tokenAccountsCache.userOwnedChunks.get(publicKey.toBase58());
            if (userChunks != undefined) {
                setUserOwnedChunks(userChunks);
            } else {
                setUserOwnedChunks(null);
            }
        }

        let binding = tapClient.tokenAccountsCache.OnUserChunksUpdated.add((userPubkey, chunks) => {
            console.log("got user owned chunks update");
            if (userPubkey == publicKey) {
                setUserOwnedChunks(chunks);
            }
        });

        return () => {
            tapClient.tokenAccountsCache.OnUserChunksUpdated.detach(binding);
        };
    }, [publicKey]);

    console.log("user Owned Chunks: ", userOwnedChunks?.length);

    // Figure out how to turn patch chunk bitmaps into an image
    // create a react element for the list item with chunk as props

    const listSx = {
        width: "100%",
        height: "100%",
        maxWidth: 360,
        bgcolor: "background.paper",
        position: "relative",
        overflow: "auto",
        maxHeight: 500,
    };

    return (
        <List sx={listSx}>
            {userOwnedChunks != null ? (
                userOwnedChunks.map((chunk) => {
                    return (
                        <MyPatchListItem
                            key={"" + chunk.xChunk + "," + chunk.yChunk}
                            chunk={chunk}
                        ></MyPatchListItem>
                    );
                })
            ) : (
                <></>
            )}
        </List>
    );
};

export const Floater: FC = () => {
    const [expanded, setExpanded] = useState<boolean>(false);
    const [menuState, setMenuState] = useState<MenuState>(MenuState.MyPatches);
    let styles = { ...FloaterContainerSx };

    if (!expanded) {
        styles.bottom = undefined;
        styles.height = 100;
    }

    const onClickedMyPatches = () => {
        if (expanded && menuState == MenuState.MyPatches) {
            setExpanded(false);
        } else {
            setMenuState(MenuState.MyPatches);
            setExpanded(true);
        }
    };

    return (
        <Container sx={styles}>
            <Box
                sx={{
                    display: "flex",
                    p: 1,
                    m: 1,
                    top: 0,
                    left: 0,
                    right: 0,
                    // background: "red",
                    height: 100,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ButtonGroup>
                    <Button>Featured</Button>
                    <Button onClick={onClickedMyPatches}>My Patches</Button>
                    <Button>For Sale</Button>
                </ButtonGroup>
            </Box>
            {menuState == MenuState.MyPatches && expanded ? <MyPatches></MyPatches> : <></>}
        </Container>
    );
};
