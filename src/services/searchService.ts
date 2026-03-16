import OpenAI from "openai";

/**
 * Service to fetch live market trends and booming technologies.
 * This can be expanded to use dedicated Search APIs like Serper.dev or Tavily.
 */
export async function fetchMarketTrends(topic: string, learnerLevel: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const searchApiKey = process.env.SERPER_API_KEY;

  if (searchApiKey) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": searchApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: `latest booming ${topic} modules and job market skills ${currentYear} ${currentYear + 1} ${learnerLevel} level`,
          num: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Extract snippets to create a context string
        const snippets = data.organic?.map((item: any) => item.snippet).join("\n") || "";
        if (snippets) {
          return snippets;
        }
      }
    } catch (error) {
      console.error("Search API failed, falling back to intelligence module:", error);
    }
  }

  // Fallback: If no API key or search fails, use a high-quality summary prompt to simulate the "latest" knowledge
  // Note: Since this is running in the backend, we can also use the primary OpenAI instance to "summarize" what it knows about the latest trends.
  return `Provide a summary of the most in-demand ${topic} skills for ${currentYear}-${currentYear + 1} targeting ${learnerLevel} learners. 
  Focus on "booming" technologies, cloud-native trends, and specific tools that are currently seeing a spike in recruitment.`;
}
