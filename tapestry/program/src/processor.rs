use crate::{
    error::TapestryError,
    instruction::{
        InitTapestryAccountArgs, InitTapestryDataArgs, PurchasePatchAccountArgs,
        PurchasePatchDataArgs, PushFeaturedAccountArgs, PushFeaturedDataArgs, TapestryInstruction,
        UpdatePatchAccountArgs, UpdatePatchImageDataArgs, UpdatePatchMetadataDataArgs,
    },
    state::{
        assert_featured_region_valid, assert_patch_is_valid, find_featured_state_address,
        find_mint_address_for_patch_coords, find_patch_address_for_patch_coords,
        find_tapestry_state_address, FeaturedRegion, FeaturedState, TapestryPatch, TapestryState,
        MAX_FEATURED_REGIONS, MAX_PATCH_IMAGE_DATA_LEN, MAX_PATCH_TOTAL_LEN,
        MAX_TAPESTRY_FEATURED_ACCOUNT_LEN, TAPESTRY_FEATURED_PDA_PREFIX, TAPESTRY_MINT_PDA_PREFIX,
        TAPESTRY_PDA_PREFIX, TAPESTRY_STATE_MAX_LEN,
    },
    utils::{
        assert_coords_valid, assert_signer, chunk_for_coords, create_or_allocate_account_raw,
        ChunkCoords,
    },
};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction,
};

use mpl_token_metadata::{
    instruction::{create_metadata_accounts_v2, verify_collection, CreateMetadataAccountArgs},
    state::{Collection, Creator},
};

use spl_token::{
    instruction::{initialize_mint, AuthorityType},
    state::{Account as TokenAccount, Mint},
};

use spl_associated_token_account::{create_associated_token_account, get_associated_token_address};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = TapestryInstruction::try_from_slice(instruction_data)?;

        match instruction {
            TapestryInstruction::InitTapestry(args) => {
                msg!("Instruction: InitTapestry");

                let acct_info_iter = &mut accounts.iter();
                let owner_acct = next_account_info(acct_info_iter)?;
                let tapestry_state_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;
                let featured_state_acct = next_account_info(acct_info_iter)?;
                let account_args = InitTapestryAccountArgs {
                    owner_acct,
                    tapestry_state_acct,
                    system_acct,
                    featured_state_acct,
                };

                process_init_tapestry(program_id, &account_args, &args)
            }
            TapestryInstruction::PurchasePatch(args) => {
                msg!("Instruction: PurchasePatch");

                let acct_info_iter = &mut accounts.iter();
                let buyer_acct = next_account_info(acct_info_iter)?;
                let tapestry_state_acct = next_account_info(acct_info_iter)?;
                let tapestry_patch_acct = next_account_info(acct_info_iter)?;
                let tapestry_patch_mint_acct = next_account_info(acct_info_iter)?;
                let associated_token_acct_for_patch = next_account_info(acct_info_iter)?;
                let token_prog_acct = next_account_info(acct_info_iter)?;
                let associated_token_prog_acct = next_account_info(acct_info_iter)?;
                let rent_sysvar_acct = next_account_info(acct_info_iter)?;
                let system_prog_acct = next_account_info(acct_info_iter)?;
                let mpl_token_metadata_acct = next_account_info(acct_info_iter)?;
                let mpl_metadata_pda_acct = next_account_info(acct_info_iter)?;

                let acct_args = PurchasePatchAccountArgs {
                    buyer_acct,
                    tapestry_state_acct,
                    tapestry_patch_acct,
                    tapestry_patch_mint_acct,
                    associated_token_acct_for_patch,
                    token_prog_acct,
                    associated_token_prog_acct,
                    rent_sysvar_acct,
                    system_prog_acct,
                    mpl_token_metadata_acct,
                    mpl_metadata_pda_acct,
                };

                process_purchase_patch(program_id, &acct_args, &args)
            }
            TapestryInstruction::UpdatePatchImage(args) => {
                msg!("Instruction: UpdatePatch");
                let acct_info_iter = &mut accounts.iter();
                let owner_acct = next_account_info(acct_info_iter)?;
                let token_acct = next_account_info(acct_info_iter)?;
                let patch_acct = next_account_info(acct_info_iter)?;

                let acct_args = UpdatePatchAccountArgs {
                    owner_acct,
                    token_acct,
                    patch_acct,
                };

                process_update_patch_image(program_id, &acct_args, &args)
            }
            TapestryInstruction::UpdatePatchMetadata(args) => {
                msg!("Instruction: UpdatePatch");
                let acct_info_iter = &mut accounts.iter();
                let owner_acct = next_account_info(acct_info_iter)?;
                let token_acct = next_account_info(acct_info_iter)?;
                let patch_acct = next_account_info(acct_info_iter)?;

                let acct_args = UpdatePatchAccountArgs {
                    owner_acct,
                    token_acct,
                    patch_acct,
                };

                process_update_patch_metadata(program_id, &acct_args, &args)
            }
            TapestryInstruction::PushFeatured(args) => {
                msg!("Instruction: PushFeatured");
                let acct_info_iter = &mut accounts.iter();
                let owner_acct = next_account_info(acct_info_iter)?;
                let tapestry_state_acct = next_account_info(acct_info_iter)?;
                let featured_state_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;
                let acct_args = PushFeaturedAccountArgs {
                    owner_acct,
                    tapestry_state_acct,
                    featured_state_acct,
                    system_acct,
                };

                process_push_featured(program_id, acct_args, &args)
            }
        }
    }
}

fn process_init_tapestry(
    program_id: &Pubkey,
    account_args: &InitTapestryAccountArgs,
    data_args: &InitTapestryDataArgs,
) -> ProgramResult {
    let InitTapestryAccountArgs {
        owner_acct,
        tapestry_state_acct,
        system_acct,
        featured_state_acct,
    } = account_args;

    assert_signer(owner_acct)?;

    let InitTapestryDataArgs { initial_sale_price } = data_args;

    let (key, state_bump) =
        Pubkey::find_program_address(&[TAPESTRY_PDA_PREFIX.as_bytes()], program_id);

    if key != *tapestry_state_acct.key {
        return Err(TapestryError::InvalidTapestryStatePDA.into());
    }

    if !tapestry_state_acct.data_is_empty() {
        return Err(TapestryError::InvalidTapestryStatePDA.into());
    }

    // Allocate space for the tapestry state in the PDA account, subtracting the necessary rent from the payer
    create_or_allocate_account_raw(
        *program_id,
        tapestry_state_acct,
        system_acct,
        owner_acct,
        TAPESTRY_STATE_MAX_LEN,
        &[TAPESTRY_PDA_PREFIX.as_bytes(), &[state_bump]],
    )?;

    let mut tapestry_state: TapestryState =
        try_from_slice_unchecked(&tapestry_state_acct.try_borrow_data()?)?;
    tapestry_state.is_initialized = true;
    tapestry_state.owner = *owner_acct.key;
    tapestry_state.initial_sale_price = *initial_sale_price;

    tapestry_state.serialize(&mut *tapestry_state_acct.data.borrow_mut())?;

    // Initialize the featured state account

    let (key, featured_bump) = find_featured_state_address(program_id);

    if key != *featured_state_acct.key {
        return Err(TapestryError::InvalidTapestryFeaturedPDA.into());
    }

    if !featured_state_acct.data_is_empty() {
        return Err(TapestryError::InvalidTapestryFeaturedPDA.into());
    }

    create_or_allocate_account_raw(
        *program_id,
        featured_state_acct,
        system_acct,
        owner_acct,
        MAX_TAPESTRY_FEATURED_ACCOUNT_LEN,
        &[
            TAPESTRY_PDA_PREFIX.as_bytes(),
            TAPESTRY_FEATURED_PDA_PREFIX.as_bytes(),
            &[featured_bump],
        ],
    )?;

    let featured: Vec<FeaturedRegion> = vec![];
    let mut featured_state: FeaturedState = FeaturedState { featured };

    featured_state.serialize(&mut *featured_state_acct.data.borrow_mut());

    Ok(())
}

fn process_purchase_patch(
    program_id: &Pubkey,
    account_args: &PurchasePatchAccountArgs,
    data_args: &PurchasePatchDataArgs,
) -> ProgramResult {
    // TODO(will): Don't pass account args as reference, creates weird double reference
    let PurchasePatchAccountArgs {
        buyer_acct,
        tapestry_state_acct,
        tapestry_patch_acct,
        tapestry_patch_mint_acct,
        associated_token_acct_for_patch,
        token_prog_acct,
        associated_token_prog_acct,
        rent_sysvar_acct,
        system_prog_acct,
        mpl_token_metadata_acct,
        mpl_metadata_pda_acct,
    } = account_args;

    let PurchasePatchDataArgs { x, y } = data_args;

    // ***** Validate stuff ******

    assert_signer(buyer_acct)?;

    // Validate the patch account and make sure it hasn't already been initialized
    msg!("validating state, patch, and mint accounts");

    let (patch_addr, patch_addr_bump) = find_patch_address_for_patch_coords(*x, *y, program_id);
    if patch_addr != *tapestry_patch_acct.key {
        return Err(TapestryError::InvalidTapestryPatchPDA.into());
    }
    if !tapestry_patch_acct.data_is_empty() {
        return Err(TapestryError::TapestryPatchAlreadySold.into());
    }

    let (mint_addr, mint_addr_bump) = find_mint_address_for_patch_coords(*x, *y, program_id);
    if mint_addr != *tapestry_patch_mint_acct.key {
        return Err(TapestryError::InvalidTapestryPatchMintPDA.into());
    }
    if !tapestry_patch_mint_acct.data_is_empty() {
        return Err(TapestryError::InvalidTapestryPatchMintPDA.into());
    }

    let ata_addr = get_associated_token_address(buyer_acct.key, tapestry_patch_mint_acct.key);
    if ata_addr != *associated_token_acct_for_patch.key {
        return Err(TapestryError::InvalidTapestryPatchAssociatedTokenAccount.into());
    }

    let (state_addr, state_addr_bump) = find_tapestry_state_address(program_id);
    if state_addr != *tapestry_state_acct.key {
        return Err(TapestryError::InvalidTapestryStatePDA.into());
    }

    // TODO(will): validate program ID?

    // TODO(will): check up front if owner has required rent to create all accounts?

    // ***** Business Logic ******

    // Pay for the patch

    let tapestry_state: TapestryState =
        try_from_slice_unchecked(&tapestry_state_acct.try_borrow_data()?)?;

    if buyer_acct.lamports() < tapestry_state.initial_sale_price {
        return Err(TapestryError::InsufficientFundsForPurchase.into());
    }

    invoke(
        &system_instruction::transfer(
            &buyer_acct.key,
            tapestry_state_acct.key,
            tapestry_state.initial_sale_price,
        ),
        &[
            (*buyer_acct).clone(),
            (*tapestry_state_acct).clone(),
            (*system_prog_acct).clone(),
        ],
    )?;

    let tapestry_patch_mint_acct_seeds = &[
        TAPESTRY_PDA_PREFIX.as_bytes(),
        TAPESTRY_MINT_PDA_PREFIX.as_bytes(),
        &x.to_le_bytes(),
        &y.to_le_bytes(),
        &[mint_addr_bump],
    ];

    let tapestry_state_acct_seeds = &[TAPESTRY_PDA_PREFIX.as_bytes(), &[state_addr_bump]];

    msg!("Creating token mint account");

    // Create a token mint account
    create_or_allocate_account_raw(
        *token_prog_acct.key,
        tapestry_patch_mint_acct,
        system_prog_acct,
        buyer_acct,
        Mint::LEN,
        tapestry_patch_mint_acct_seeds,
    )?;

    let ix_init_mint = initialize_mint(
        token_prog_acct.key,
        tapestry_patch_mint_acct.key,
        tapestry_state_acct.key,
        // NOTE(will): This is a hack to allow clients to get the address
        // for a patch account from the token mint account
        // Alternatively, this link could be made via token metadata
        Some(tapestry_patch_acct.key),
        0,
    )?;

    invoke_signed(
        &ix_init_mint,
        &[
            (*token_prog_acct).clone(),
            (*tapestry_state_acct).clone(),
            (*tapestry_patch_mint_acct).clone(),
            (*rent_sysvar_acct).clone(),
            (*tapestry_patch_acct).clone(),
        ],
        &[tapestry_state_acct_seeds],
    )?;

    msg!("Creating associated token account");

    // Create a token account to hold the minted token and give to owner

    // TODO(will): Figure out what happens if this account already exists

    let ix_create_token_acct = create_associated_token_account(
        buyer_acct.key,
        buyer_acct.key,
        tapestry_patch_mint_acct.key,
    );

    invoke_signed(
        &ix_create_token_acct,
        &[
            (*associated_token_acct_for_patch).clone(),
            (*buyer_acct).clone(),
            (*tapestry_patch_mint_acct).clone(),
            (*token_prog_acct).clone(),
            (*associated_token_prog_acct).clone(),
            (*rent_sysvar_acct).clone(),
            (*system_prog_acct).clone(),
        ],
        &[],
    )?;

    msg!("Minting NFT into associated token account");

    let ix_mint_token = spl_token::instruction::mint_to(
        token_prog_acct.key,
        tapestry_patch_mint_acct.key,
        associated_token_acct_for_patch.key,
        tapestry_state_acct.key,
        &[tapestry_state_acct.key],
        1,
    )?;

    invoke_signed(
        &ix_mint_token,
        &[
            (*token_prog_acct).clone(),
            (*tapestry_patch_mint_acct).clone(),
            (*tapestry_state_acct).clone(),
            (*associated_token_acct_for_patch).clone(),
            (*buyer_acct).clone(),
        ],
        &[tapestry_state_acct_seeds],
    )?;

    // NOTE(will): maybe this can just be done after allocating token metatdata

    // msg!("Removing mint authority to limit supply to one");

    // let ix_remove_authority = spl_token::instruction::set_authority(
    //     token_prog_acct.key,
    //     tapestry_patch_mint_acct.key,
    //     Option::None,
    //     AuthorityType::MintTokens,
    //     tapestry_state_acct.key,
    //     &[&tapestry_state_acct.key],
    // )?;

    // invoke_signed(
    //     &ix_remove_authority,
    //     &[
    //         (*token_prog_acct).clone(),
    //         (*tapestry_patch_mint_acct).clone(),
    //         (*tapestry_state_acct).clone(),
    //     ],
    //     &[tapestry_patch_mint_acct_seeds, tapestry_state_acct_seeds],
    // )?;

    msg!("Allocating patch account to hold patch data");

    create_or_allocate_account_raw(
        *program_id,
        tapestry_patch_acct,
        system_prog_acct,
        buyer_acct,
        MAX_PATCH_TOTAL_LEN,
        &[
            TAPESTRY_PDA_PREFIX.as_bytes(),
            &x.to_le_bytes(),
            &y.to_le_bytes(),
            &[patch_addr_bump],
        ],
    )?;

    let ChunkCoords { x_chunk, y_chunk } = chunk_for_coords(*x, *y);

    let tapestry_patch = TapestryPatch {
        is_initialized: true,
        owned_by_mint: *tapestry_patch_mint_acct.key,
        x_chunk: x_chunk,
        y_chunk: y_chunk,
        x: *x,
        y: *y,
        url: None,
        hover_text: None,
        image_data: None,
    };

    assert_patch_is_valid(&tapestry_patch);

    // Create Token metadata

    let meta_program_id = mpl_token_metadata::id();

    let metadata_seeds = &[
        mpl_token_metadata::state::PREFIX.as_bytes(),
        meta_program_id.as_ref(),
        tapestry_patch_mint_acct.key.as_ref(),
    ];

    let (metadata_pda, _) = Pubkey::find_program_address(metadata_seeds, &meta_program_id);

    // TODO(will): assert this pda matches one passed in?

    let ix_create_metadata = create_metadata_accounts_v2(
        mpl_token_metadata::id(),
        metadata_pda,
        tapestry_patch_mint_acct.key.clone(),
        tapestry_state_acct.key.clone(),
        buyer_acct.key.clone(),
        tapestry_state_acct.key.clone(),
        format!("Tapestry {},{}", x, y),
        String::from("TAPESTRY"),
        // TODO(will): ideally we store the metadata on the "permaweb" in arweave
        // but practicaly may be easier to just host these ourselves, I can't figure out
        // how to buy the arweave tokens, lol
        format!("https://nft.tapestry.art/{}/{}", x, y),
        Some(vec![Creator {
            address: tapestry_state_acct.key.clone(),
            verified: true,
            share: 100,
        }]),
        500,
        true,
        false,
        Some(Collection {
            verified: false, // Have to do this via a separate instruction
            key: tapestry_state_acct.key.clone(),
        }),
        None,
    );

    invoke_signed(
        &ix_create_metadata,
        &[
            (*mpl_token_metadata_acct).clone(),
            (*tapestry_patch_mint_acct).clone(),
            (*buyer_acct).clone(),
            (*tapestry_state_acct).clone(),
            (*rent_sysvar_acct).clone(),
            (*system_prog_acct).clone(),
            (*mpl_metadata_pda_acct).clone(),
        ],
        &[tapestry_patch_mint_acct_seeds, tapestry_state_acct_seeds],
    )?;

    // TODO(will): Verify the collection, I believe this involves calling the ApproveCollectionAuthority
    // instruction on the token metadata program and then calling this verify_collection on each
    // newly minted NFT
    // let ix_verify_collection = verify_collection(
    //     mpl_token_metadata::id(),
    //     metadata_pda,
    //     tapestry_patch_state_acct.key.clone(),
    //     buyer_acct.key.clone(),

    // )

    // The rest of the state can be updated via 'UpdatePatch' instructions
    tapestry_patch.serialize(&mut *tapestry_patch_acct.data.borrow_mut())?;

    Ok(())
}

fn process_update_patch_image(
    program_id: &Pubkey,
    acct_args: &UpdatePatchAccountArgs,
    data_args: &UpdatePatchImageDataArgs,
) -> ProgramResult {
    let UpdatePatchAccountArgs {
        owner_acct,
        token_acct,
        patch_acct,
    } = *acct_args;

    assert_signer(owner_acct)?;

    // Because only this program can generate these PDA's I think most of this validation
    // is actually unecessary, because it would basically just be catching bugs in the purchase
    // instruction

    // TODO(will): The bump is only 1 byte, should probably pass in ix data
    // to reduce compute overhead
    let (patch_addr, patch_addr_bump) =
        find_patch_address_for_patch_coords(data_args.x, data_args.y, program_id);

    // let (tapestry_state_addr, tapestry_state_bump) = find_tapestry_state_address(program_id);
    if patch_addr != *patch_acct.key {
        return Err(TapestryError::InvalidTapestryPatchPDA.into());
    }

    if patch_acct.data_is_empty() {
        return Err(TapestryError::PatchAccountNotAllocated.into());
    }

    let (mint_addr, mint_addr_bump) =
        find_mint_address_for_patch_coords(data_args.x, data_args.y, program_id);

    let mut patch_acct_unpacked: TapestryPatch =
        try_from_slice_unchecked(&patch_acct.data.borrow_mut())?;

    if patch_acct_unpacked.owned_by_mint != mint_addr {
        return Err(TapestryError::PatchAccountNotOwnedByMint.into());
    }

    let token_acct_unpacked = TokenAccount::unpack(&token_acct.data.borrow())?;

    if token_acct.owner != &spl_token::id() {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    if token_acct_unpacked.mint != mint_addr {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    if token_acct_unpacked.amount != 1 {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    patch_acct_unpacked.image_data = Some(data_args.image_data.clone());

    assert_patch_is_valid(&patch_acct_unpacked)?;

    patch_acct_unpacked.serialize(&mut *patch_acct.try_borrow_mut_data()?)?;

    Ok(())
}

fn process_update_patch_metadata(
    program_id: &Pubkey,
    acct_args: &UpdatePatchAccountArgs,
    data_args: &UpdatePatchMetadataDataArgs,
) -> ProgramResult {
    let UpdatePatchAccountArgs {
        owner_acct,
        token_acct,
        patch_acct,
    } = *acct_args;

    assert_signer(owner_acct)?;

    // TODO(will): this logic is duplicated with update image, factor it into it's own 'assert' fn

    let (patch_addr, patch_addr_bump) =
        find_patch_address_for_patch_coords(data_args.x, data_args.y, program_id);

    // let (tapestry_state_addr, tapestry_state_bump) = find_tapestry_state_address(program_id);
    if patch_addr != *patch_acct.key {
        return Err(TapestryError::InvalidTapestryPatchPDA.into());
    }

    if patch_acct.data_is_empty() {
        return Err(TapestryError::PatchAccountNotAllocated.into());
    }

    let (mint_addr, mint_addr_bump) =
        find_mint_address_for_patch_coords(data_args.x, data_args.y, program_id);

    let mut patch_acct_unpacked: TapestryPatch =
        try_from_slice_unchecked(&patch_acct.data.borrow_mut())?;

    if patch_acct_unpacked.owned_by_mint != mint_addr {
        return Err(TapestryError::PatchAccountNotOwnedByMint.into());
    }

    let token_acct_unpacked = TokenAccount::unpack(&token_acct.data.borrow())?;

    if token_acct.owner != &spl_token::id() {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    if token_acct_unpacked.mint != mint_addr {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    if token_acct_unpacked.amount != 1 {
        return Err(TapestryError::InvalidPatchTokenAccount.into());
    }

    patch_acct_unpacked.url = data_args.url.clone();
    patch_acct_unpacked.hover_text = data_args.hover_text.clone();

    assert_patch_is_valid(&patch_acct_unpacked)?;

    patch_acct_unpacked.serialize(&mut *patch_acct.try_borrow_mut_data()?)?;

    Ok(())
}

fn process_push_featured(
    program_id: &Pubkey,
    acct_args: PushFeaturedAccountArgs,
    data_args: &PushFeaturedDataArgs,
) -> ProgramResult {
    let PushFeaturedAccountArgs {
        owner_acct,
        tapestry_state_acct,
        featured_state_acct,
        system_acct,
    } = acct_args;

    let PushFeaturedDataArgs { region } = data_args;

    assert_signer(owner_acct)?;
    assert_featured_region_valid(&region);

    let (tapestry_state_pda, _) = find_tapestry_state_address(program_id);
    let (featured_state_pda, _) = find_featured_state_address(program_id);

    if *tapestry_state_acct.key != tapestry_state_pda {
        return Err(TapestryError::InvalidTapestryStatePDA.into());
    }

    if *featured_state_acct.key != featured_state_pda {
        return Err(TapestryError::InvalidTapestryFeaturedPDA.into());
    }

    let tapestry_state: TapestryState =
        try_from_slice_unchecked(*tapestry_state_acct.try_borrow_data()?)?;

    if *owner_acct.key != tapestry_state.owner {
        return Err(TapestryError::IncorrectOwner.into());
    }

    let mut featured_state: FeaturedState =
        try_from_slice_unchecked(*featured_state_acct.try_borrow_data()?)?;

    featured_state.featured.insert(0, region.clone());

    while featured_state.featured.len() > MAX_FEATURED_REGIONS {
        featured_state.featured.pop();
    }

    featured_state.serialize(&mut *featured_state_acct.data.borrow_mut())?;

    Ok(())
}
