async function callGasApi(action, data = {}) {
  try {
    const payload = { action: action, data: data };
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[GAS通信エラー] action: ${action}`, error);
    throw error;
  }
}