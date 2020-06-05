#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const os = require('os')
const { prompt } = require('enquirer')
const chalk = require('chalk')
const {
  generateEth1Account,
  waitForTx,
  exportWallet,
  getValidatorAccount,
  createValidatorAccount
} = require('../lib/accounts')
const { getCaptcha, checkCaptcha, requestFunds } = require('../lib/faucet')

const { ethers } = require('ethers')


const getResponse = async prompt => {
  try {
    let answer = await prompt.run()
    return answer
  } catch (error) {
    process.exit()
    return undefined
  }
}

const parseTxData = (raw_tx_data) => {
  /*
  const contractJson = await ethpkg.download('https://raw.githubusercontent.com/ethereum/eth2.0-specs/dev/deposit_contract/contracts/validator_registration.json')
  const depositContract = JSON.parse(contractJson.toString())
  */
  const abi = [
    {
      "name": "DepositEvent",
      "inputs": [
        { "type": "bytes", "name": "pubkey", "indexed": false },
        { "type": "bytes", "name": "withdrawal_credentials", "indexed": false },
        { "type": "bytes", "name": "amount", "indexed": false },
        { "type": "bytes", "name": "signature", "indexed": false },
        { "type": "bytes", "name": "index", "indexed": false }
      ],
      "anonymous": false,
      "type": "event"
    },
    { "outputs": [], "inputs": [], "constant": false, "payable": false, "type": "constructor" },
    {
      "name": "get_deposit_root",
      "outputs": [{ "type": "bytes32", "name": "out" }],
      "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 95628
    },
    {
      "name": "get_deposit_count",
      "outputs": [{ "type": "bytes", "name": "out" }],
      "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 18231
    },
    {
      "name": "deposit", "outputs": [],
      "inputs": [{ "type": "bytes", "name": "pubkey" },
      { "type": "bytes", "name": "withdrawal_credentials" },
      { "type": "bytes", "name": "signature" },
      { "type": "bytes32", "name": "deposit_data_root" }], "constant": false, "payable": true, "type": "function", "gas": 1342274
    }
  ]
  let iface = new ethers.utils.Interface(abi);
  let parsed = iface.parseTransaction({ data: raw_tx_data });
  return parsed
}

const OPTIONS = {
  'CREATE': 'create validator',
  'START': 'start validator'
}

const run = async () => {

  console.log('='.repeat(process.stdout.columns))
  console.log('Welcome to create eth2-test-account:')
  console.log('This interactive wizard will install and configure everything you need to try out Eth2 (for testing purposes only)')
  console.log('='.repeat(process.stdout.columns))

  let questions = [
    {
      type: 'select',
      name: 'action',
      message: '🧐 What can I do for you?',
      choices: [{ message: 'Create eth2 validator account', name: OPTIONS.CREATE }, { message: 'Run existing validator', name: OPTIONS.START }]
    },
    {
      type: 'confirm',
      name: 'useDocker',
      message: '🐳 Use Docker? (must be installed and running)?'
    },
    /*
    {
      type: 'password',
      name: 'validatorPwd',
      message: 'Please enter a validator password? (default: "changeme")',
      default: 'foo'
    }
    */
  ]

  // let answers = await prompt(questions);
  // console.log(answers);


  /*
 questions = [
   {
     type: 'select',
     name: 'accountType',
     message: '🔑 Where do you want to store the validator keys?',
     choices: [{ message: path.join(process.cwd(), '.prysm'), name: OPTIONS.CREATE },  path.join(os.homedir(), '.prysm')]
   },
   {
     type: 'password',
     name: 'validatorPwd',
     message: '🤐 Please enter a validator password? (default: foo)',
     default: 'changeme'
   }
 ]
 answers = await prompt(questions);
 */
  const keyStore = path.join(process.cwd(), 'keys')
  fs.mkdirSync(keyStore, { recursive: true })
  const password = 'foo'

  let account = await getValidatorAccount(keyStore)

  /*
  const useDocker = false
  let raw_tx_data = await createValidatorAccount(useDocker, keyStore, password)
  // console.log('raw tx', raw_tx_data.length, raw_tx_data)
  const parsed = await parseTxData(raw_tx_data)
  // console.log('parsed tx', parsed)
  */

  const { wallet, address } = await generateEth1Account()
  const walletPath = await exportWallet(wallet, '12345', './keys')

  if (!fs.existsSync(walletPath)) {
    throw new Error('Could not write wallet to disk')
  }

  /*
  const { captcha, challenge } = await getCaptcha()
  console.log(captcha)

  let isValid = false
  let answer = ''
  while (!isValid) {
    // ask user for captcha
    try {
      let result = await prompt({
        type: 'input',
        name: 'answer',
        message: 'Please enter the captcha'
      })
      answer = result.answer
      isValid = await checkCaptcha(challenge, answer)
      if (!isValid) {
        console.log(chalk.red.bold('>> Wrong captcha - please try again'))
      }
    } catch (error) {
      process.exit()
    }
  }

  console.log(chalk.blueBright.bold('Success! Requesting funds..'))
  */
  const challenge = '123'
  const answer = '123'

  let txHash
  try {
    txHash = await requestFunds(address, challenge, answer)
  } catch (error) {
    const { response } = error
    const { status, statusText, data } = response
    console.log(chalk.red.bold('Server error', status, statusText, data))
    process.exit()
  }

  console.log(`https://goerli.etherscan.io/tx/${txHash}`)
  console.log('Waiting for tx to be confirmed...')
  const receipt = await waitForTx(txHash, 5, 120*1000)
  console.log('receipt', receipt)

  console.log(chalk.bold(`💸 Great! Now, the account ${address} has enough stake to participate in Eth2 and to activate a validator`))

  return

  console.log('Sending the validator deposit now')

  // const walletPath = await exportWallet(wallet, password, exportDir)


  return


}

run()
.then(() => {
  process.exit()
})
.catch(error => {
  console.error(error)
})