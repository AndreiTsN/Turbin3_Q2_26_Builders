pub mod  state;
pub mod constants;
pub mod instructions;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("Q5NNzft9B5M5pvRnACoRMYsMy4EacadXxnJ2yZEw854");

#[program]
pub mod anchor_vault_q2_26 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    
    }
    
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
        
    }
    
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
        
    }
    
    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close()
        
    }
    

}


