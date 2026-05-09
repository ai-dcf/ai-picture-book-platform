export async function simulateGeneration(durationMs = 2500): Promise<string> {
  await new Promise(r => setTimeout(r, durationMs));
  const seed = Math.floor(Math.random() * 9999);
  return `https://picsum.photos/seed/${seed}/600/600`;
}

export async function simulateMultiple(count: number, durationMs = 2500): Promise<string[]> {
  await new Promise(r => setTimeout(r, durationMs));
  return Array.from({ length: count }, () => {
    const seed = Math.floor(Math.random() * 9999);
    return `https://picsum.photos/seed/${seed}/400/400`;
  });
}
