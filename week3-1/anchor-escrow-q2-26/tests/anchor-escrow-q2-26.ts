import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { AnchorEscrowQ226 } from "../target/types/anchor_escrow_q2_26";
import NodeWallet from "@anchor-lang/core/dist/cjs/nodewallet";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("anchor-escrow happy paths", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorEscrowQ226 as Program<AnchorEscrowQ226>;
  const connection = provider.connection;
  const payer = provider.wallet as NodeWallet;

  async function confirmTx(signature: string) {
    const latestBlockhash = await connection.getLatestBlockhash();

    await connection.confirmTransaction(
      {
        signature,
        ...latestBlockhash,
      },
      "confirmed",
    );
  }

  async function airdrop(pubkey: PublicKey) {
    const balance = await connection.getBalance(pubkey);

    if (balance > anchor.web3.LAMPORTS_PER_SOL) {
      return;
    }

    const sig = await connection.requestAirdrop(
      pubkey,
      100 * anchor.web3.LAMPORTS_PER_SOL,
    );

    await confirmTx(sig);
  }

  async function createTestContext() {
    const taker = Keypair.generate();

    await airdrop(payer.publicKey);
    await airdrop(taker.publicKey);

    const mintA = await createMint(
      connection,
      payer.payer,
      payer.publicKey,
      payer.publicKey,
      6,
    );

    const mintB = await createMint(
      connection,
      payer.payer,
      payer.publicKey,
      payer.publicKey,
      6,
    );

    const makerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintA,
        payer.publicKey,
      )
    ).address;

    const makerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintB,
        payer.publicKey,
      )
    ).address;

    const takerAtaA = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintA,
        taker.publicKey,
      )
    ).address;

    const takerAtaB = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintB,
        taker.publicKey,
      )
    ).address;

    await mintTo(
      connection,
      payer.payer,
      mintA,
      makerAtaA,
      payer.payer,
      1_000_000_000,
    );

    await mintTo(
      connection,
      payer.payer,
      mintB,
      takerAtaB,
      payer.payer,
      1_000_000_000,
    );

    const seed = new BN(randomBytes(8));

    const escrow = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        payer.publicKey.toBuffer(),
        seed.toBuffer("le", 8),
      ],
      program.programId,
    )[0];

    const vault = getAssociatedTokenAddressSync(mintA, escrow, true);

    return {
      taker,
      mintA,
      mintB,
      makerAtaA,
      makerAtaB,
      takerAtaA,
      takerAtaB,
      seed,
      escrow,
      vault,
    };
  }

  it("make: maker creates escrow and deposits token A into vault", async () => {
    const ctx = await createTestContext();

    const tx = await program.methods
      .make(ctx.seed, new BN(1_000_000), new BN(1_000_000), new BN(60))
      .accountsStrict({
        maker: payer.publicKey,
        mintA: ctx.mintA,
        mintB: ctx.mintB,
        makerAtaA: ctx.makerAtaA,
        escrow: ctx.escrow,
        vault: ctx.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await confirmTx(tx);

    const vaultAccount = await getAccount(connection, ctx.vault);

    expect(Number(vaultAccount.amount)).to.equal(1_000_000);
  });

  it("take: taker accepts escrow and completes exchange", async () => {
    const ctx = await createTestContext();

    const makeTx = await program.methods
      .make(ctx.seed, new BN(1_000_000), new BN(1_000_000), new BN(60))
      .accountsStrict({
        maker: payer.publicKey,
        mintA: ctx.mintA,
        mintB: ctx.mintB,
        makerAtaA: ctx.makerAtaA,
        escrow: ctx.escrow,
        vault: ctx.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await confirmTx(makeTx);

    const takeTx = await program.methods
      .take()
      .accountsStrict({
        taker: ctx.taker.publicKey,
        maker: payer.publicKey,
        takerAtaA: ctx.takerAtaA,
        takerAtaB: ctx.takerAtaB,
        mintA: ctx.mintA,
        mintB: ctx.mintB,
        escrow: ctx.escrow,
        makerAtaA: ctx.makerAtaA,
        makerAtaB: ctx.makerAtaB,
        vault: ctx.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ctx.taker])
      .rpc();

    await confirmTx(takeTx);

    const takerAtaA = await getAccount(connection, ctx.takerAtaA);
    const makerAtaB = await getAccount(connection, ctx.makerAtaB);

    expect(Number(takerAtaA.amount)).to.equal(1_000_000);
    expect(Number(makerAtaB.amount)).to.equal(1_000_000);
  });

  it("refund: maker cancels escrow and gets token A back", async () => {
    const ctx = await createTestContext();

    const makeTx = await program.methods
      .make(ctx.seed, new BN(1_000_000), new BN(1_000_000), new BN(60))
      .accountsStrict({
        maker: payer.publicKey,
        mintA: ctx.mintA,
        mintB: ctx.mintB,
        makerAtaA: ctx.makerAtaA,
        escrow: ctx.escrow,
        vault: ctx.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await confirmTx(makeTx);

    const refundTx = await program.methods
      .refund()
      .accountsStrict({
        maker: payer.publicKey,
        escrow: ctx.escrow,
        makerAtaA: ctx.makerAtaA,
        mintA: ctx.mintA,
        vault: ctx.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await confirmTx(refundTx);

    const makerAtaA = await getAccount(connection, ctx.makerAtaA);

    expect(Number(makerAtaA.amount)).to.equal(1_000_000_000);
  });
});