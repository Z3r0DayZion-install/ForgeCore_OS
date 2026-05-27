module.exports = async function proofGuardAgent(context) {
  const latestPrompt = String(context && context.prompt ? context.prompt : "");
  return {
    ok: true,
    summary: "Proof Guard agent executed.",
    recommendation: latestPrompt.includes("/proof")
      ? "Proof command detected. Keep strict verification lane active."
      : "Use /proof before sharing external evidence."
  };
};

