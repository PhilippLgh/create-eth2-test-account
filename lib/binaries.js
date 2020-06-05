const { SingleClientManager, PROCESS_EVENTS } = require('ethbinary')
const chalk = require('chalk')
const cliProgress = require('cli-progress')

const getValidator = async (version, useDocker) => {
  const progressBars = {}
  let progressBar
  const cm = new SingleClientManager()
  const validator = await cm.getClient('prysm.validator', {
    version,
    useDocker,
    listener: (newState, args) => {
      if (newState === 'download_started') {
        console.log(chalk.green.bold('Downloading Prysm binaries now...'))
        progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
        progressBar.start(100, 0);
      }
      else if (newState === 'download_progress') {
        if (!progressBar) return
        const { progress } = args
        progressBar.update(progress)
      }
      else if(newState === 'download_finished') {
        progressBar.stop()
        console.log('\n')
      } 
      else if (newState === PROCESS_EVENTS.PULL_DOCKER_IMAGE_STARTED) {
        console.log(chalk.bold('Downloading Prysm Docker image now...'))
      }
      else if (newState === PROCESS_EVENTS.PULL_DOCKER_IMAGE_PROGRESS && args && args.status === 'Downloading') {
        const downloadId = args.id
        if (!progressBars[downloadId]) {
          const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
          progressBar.start(100, 0);
          progressBars[downloadId] = progressBar
        }
        let progressBar = progressBars[downloadId]
        progressBar.update(args.progress)
      }
      else if(newState === PROCESS_EVENTS.PULL_DOCKER_IMAGE_FINISHED) {
        // set all bars to 100% on finish
        Object.values(progressBars).map(progress => progress.update(100))
      } 
    }
  })
  return validator
}

module.exports = {
  getValidator
}