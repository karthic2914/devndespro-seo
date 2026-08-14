const { anthropic, openai } = require('../clients')
const { logAiUsage } = require('./aiUsage')

let wrapped = false

function wrapAiClients() {
  if (wrapped) return
  wrapped = true

  if (anthropic?.messages?.create) {
    const originalCreate = anthropic.messages.create.bind(anthropic.messages)
    anthropic.messages.create = async function wrappedAnthropicCreate(params, options) {
      const result = await originalCreate(params, options)
      const usage = result?.usage || {}
      void logAiUsage({
        provider: 'anthropic',
        model: params?.model || result?.model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      })
      return result
    }
  }

  if (openai?.chat?.completions?.create) {
    const originalCreate = openai.chat.completions.create.bind(openai.chat.completions)
    openai.chat.completions.create = async function wrappedOpenAiCreate(params, options) {
      const result = await originalCreate(params, options)
      const usage = result?.usage || {}
      void logAiUsage({
        provider: 'openai',
        model: params?.model || result?.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
      })
      return result
    }
  }
}

module.exports = { wrapAiClients }
