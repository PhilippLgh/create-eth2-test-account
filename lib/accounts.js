const path = require('path')
const fs = require('fs')
const { ethers } = require('ethers')
const { getValidator } = require('./binaries')

const generateEth1Account = async () => {
  const wallet = ethers.Wallet.createRandom()
  const address = wallet.address
  return {
    wallet,
    address
  }
}

const waitForTx = (_txHash, targetConfirms = 5, timeout = 60 * 1000) => new Promise((resolve, reject) => {
  const provider = new ethers.getDefaultProvider('goerli')
  let lastConfirms = -1;
  let timeoutHandler = undefined
  async function handler(blockNumber) {
    let receipt = await provider.getTransactionReceipt(_txHash);
    if (receipt === null) {
      return
    }
    if (receipt.confirmation < lastConfirms) {
      clearInterval(timeoutHandler)
      provider.removeListener('block', handler)
      return reject(new Error('re-org'))
    }
    lastConfirms = receipt.confirmations
    console.log(`tx received ${lastConfirms} confirmations...`)
    if (lastConfirms > targetConfirms) {
      if (timeoutHandler) {
        clearInterval(timeoutHandler)
        provider.removeListener('block', handler)
        resolve(receipt)
      }
    }
  }
  provider.on("block", handler);
  timeoutHandler = setTimeout(() => {
    provider.removeListener('block', handler)
    reject(new Error('timeout'))
  }, timeout)
})

const generateKeystoreFilename = (address) => {
  var filename = `ceta-UTC--${new Date().toISOString().split(':').join('-')}--${address}`
  return filename;
}

const exportWallet = async (wallet, password = '', location) => {
  let jsonWallet = await wallet.encrypt(password)
  jsonWallet = JSON.stringify(JSON.parse(jsonWallet), null, 2)
  const walletPath = path.join(location, generateKeystoreFilename(wallet.address))
  fs.writeFileSync(walletPath, jsonWallet)
  return walletPath
}

const getValidatorAccount = async (keyStore) => {
  return undefined
}

// Generate a validator public/private key pair
const createValidatorAccount = async (useDocker, keyStore, password) => {

  const validator = await getValidator('1.0.0-alpha.9', useDocker)

  const isInteractive = password === undefined

  // this is the path inside the prysm container where data is written
  const containerVolume = '/data'

  let logs = []
  if (useDocker) {
    // note that run is a special version of execute that creates a container per command
    // execute would be preferable but is only possible if the container has a shell which is not the case for the provided prysm image
    // the alpine based image would dbe possible but is broken atm
    // tell the validator to write keys to /data which gets mirrored to host fs via shared volume
    logs = await validator.run(`accounts create -keystore-path ${containerVolume} ${isInteractive ? '' : `--password=${password}`}`, {
      stdio: isInteractive ? 'inherit' : 'pipe',
      volume: `${keyStore}:${containerVolume}` // we create a shared volume (directory) between host and virtual machine
    })
  } else {
    console.log('interactive?', isInteractive)
    logs = await validator.execute(`accounts create -keystore-path ${keyStore}  ${isInteractive ? '' : `--password=${password}`}`, {
      stdio: isInteractive ? 'inherit' : 'pipe',
    })
  }

  // find the raw tx in logs
  const rawTxStart = logs.findIndex(log => log.includes('====Deposit Data======'))
  const rawTx = logs[rawTxStart + 1]

  if (!rawTx || !rawTx.startsWith('0x') || rawTx.length !== 842) {
    console.log('raw tx', rawTx)
    throw new Error('Could not find tx')
  }
  return rawTx
}

module.exports = {
  generateEth1Account,
  waitForTx,
  exportWallet,
  getValidatorAccount,
  createValidatorAccount
}