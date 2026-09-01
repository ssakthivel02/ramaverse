(async function initializeRamaVerse() {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
  }

  await loadScript("js/config.js");
  await loadScript("js/api-client.js");

  const result = document.getElementById("aiResult");
  const input = document.querySelector(".searchbox input");
  const searchButton = document.querySelector(".searchbox button");
  const chips = document.querySelectorAll(".chip");

  async function verifyApiConnection() {
    if (!result) return;

    result.textContent = "Connecting securely to RamaVerse API…";

    try {
      const { body, requestId } = await window.AppApi.status();
      result.textContent = `${body.name} ${body.version} is online (${body.apiVersion}). Request ID: ${requestId}. Full Ramayana knowledge search is the next backend feature.`;
    } catch (error) {
      console.error("RamaVerse API connection failed", error);
      result.textContent = "RamaVerse API is temporarily unavailable. Please try again shortly.";
    }
  }

  searchButton?.addEventListener("click", verifyApiConnection);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (input) input.value = chip.textContent.trim();
      verifyApiConnection();
    });
  });

  window.speakQuote = function speakQuote() {
    const quote = document.querySelector(".quote")?.textContent?.trim();
    if (!quote || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(quote);
    utterance.lang = "ta-IN";
    window.speechSynthesis.speak(utterance);
  };

  window.dispatchEvent(
    new CustomEvent("app-api-ready", {
      detail: window.APP_CONFIG,
    }),
  );
})();
