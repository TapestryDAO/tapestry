import React, { FC, useState } from 'react';
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
} from '@mui/material'


const theme = createTheme({});

const FloaterContainerSx = {
    bgcolor: '#FFF',
    top: 100,
    left: 20,
    bottom: 20,
    boxShadow: 1,
    borderRadius: 2,
    position: 'absolute',
    width: 400,
}

enum MenuState {
    MyPatches,
    Featured,
    ForSale,
}

export const MyPatches: FC = () => {

    return (
        <List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
            <ListItem alignItems="flex-start">
                <ListItemAvatar>
                    <Avatar alt="Remy Sharp" src="/static/images/avatar/1.jpg" />
                </ListItemAvatar>
                <ListItemText
                    primary="Brunch this weekend?"
                    secondary={
                        <React.Fragment>
                            <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                Ali Connors
                            </Typography>
                            {" — I'll be in your neighborhood doing errands this…"}
                        </React.Fragment>
                    }
                />
            </ListItem>
            <Divider variant="inset" component="li" />
            <ListItem alignItems="flex-start">
                <ListItemAvatar>
                    <Avatar alt="Travis Howard" src="/static/images/avatar/2.jpg" />
                </ListItemAvatar>
                <ListItemText
                    primary="Summer BBQ"
                    secondary={
                        <React.Fragment>
                            <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                to Scott, Alex, Jennifer
                            </Typography>
                            {" — Wish I could come, but I'm out of town this…"}
                        </React.Fragment>
                    }
                />
            </ListItem>
            <Divider variant="inset" component="li" />
            <ListItem alignItems="flex-start">
                <ListItemAvatar>
                    <Avatar alt="Cindy Baker" src="/static/images/avatar/3.jpg" />
                </ListItemAvatar>
                <ListItemText
                    primary="Oui Oui"
                    secondary={
                        <React.Fragment>
                            <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                Sandra Adams
                            </Typography>
                            {' — Do you have Paris recommendations? Have you ever…'}
                        </React.Fragment>
                    }
                />
            </ListItem>
        </List>
    )
}

export const Floater: FC = () => {

    const [expanded, setExpanded] = useState<boolean>(false)
    const [menuState, setMenuState] = useState<MenuState>(MenuState.MyPatches)
    let styles = { ...FloaterContainerSx };

    if (!expanded) {
        styles.bottom = undefined;
        styles.height = 100
    }

    const onClickedMyPatches = () => {
        if (expanded && menuState == MenuState.MyPatches) {
            setExpanded(false)
        } else {
            setMenuState(MenuState.MyPatches)
            setExpanded(true)
        }
    }

    return (
        <Container sx={styles} >
            <Box sx={{
                display: "flex",
                p: 1,
                m: 1,
                top: 0,
                left: 0,
                right: 0,
                // background: "red",
                height: 100,
                justifyContent: "center",
                alignItems: "center"
            }}>
                <ButtonGroup>
                    <Button onClick={onClickedMyPatches}>My Patches</Button>
                    <Button>Featured</Button>
                    <Button>For Sale</Button>
                </ButtonGroup>
            </Box>
            {menuState == MenuState.MyPatches && expanded ? <MyPatches></MyPatches> : <></>}
        </Container>
    );
}