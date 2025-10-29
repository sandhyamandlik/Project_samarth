async function getAnswer() {
  const q = document.getElementById('question').value.toLowerCase();
  const ans = document.getElementById('answer');
  ans.innerHTML = 'Processing your question...';

  try {
    // Load both CSVs in parallel
    const [cropRes, rainRes] = await Promise.all([
      fetch('data/crop_production.csv'),
      fetch('data/rainfall.csv')
    ]);

    const cropText = await cropRes.text();
    const rainText = await rainRes.text();

    // --- Parse Crop CSV ---
    const cropLines = cropText.split('\n').map(l => l.trim()).filter(l => l.length);
    const cropHeader = cropLines[0].split(',').map(h => h.trim());
    const cropRows = cropLines.slice(1).map(r => r.split(',').map(c => c.trim()));

    // --- Parse Rainfall CSV ---
    const rainLines = rainText.split('\n').map(l => l.trim()).filter(l => l.length);
    const rainHeader = rainLines[0].split(',').map(h => h.trim());
    const rainRows = rainLines.slice(1).map(r => r.split(',').map(c => c.trim()));

    console.log('Rain header:', rainHeader);

    // Find the ANNUAL column index dynamically
    const annualIndex = rainHeader.findIndex(h => h.toLowerCase().includes('annual'));
    const yearIndex = rainHeader.findIndex(h => h.toLowerCase().includes('year'));

    if (annualIndex === -1) {
      console.warn('ANNUAL column not found in rainfall CSV header. Header:', rainHeader);
    } else {
      console.log('ANNUAL column index:', annualIndex);
    }

    // ---------------------------------
    // 🌧️ RAINFALL COMPARISON LOGIC
    // ---------------------------------
    if (q.includes('compare') && q.includes('rainfall')) {
      const candidateStates = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Punjab', 'Gujarat'];
      const states = candidateStates.filter(s => q.includes(s.toLowerCase()));

      if (states.length === 0) {
        ans.innerHTML = '⚠️ Please include at least one state name (e.g., Maharashtra, Karnataka) in your question.';
        return;
      }

      // Subdivision mapping for each state
      const stateMapSubstrings = {
        'Maharashtra': ['maharashtra', 'marathwada', 'vidarbha', 'madhya maharashtra', 'konkan', 'konkan & goa', 'konkan and goa'],
        'Karnataka': ['karnataka', 'north interior karnataka', 'south interior karnataka', 'coastal karnataka'],
        'Tamil Nadu': ['tamil nadu', 'chennai', 'tamilnadu'],
        'Punjab': ['punjab'],
        'Gujarat': ['gujarat', 'saurashtra', 'kutch', 'saurashtra & kutch', 'gujarat region']
      };

      // Detect latest year
      let allYears = rainRows.map(r => parseInt(r[yearIndex]));
      allYears = allYears.filter(y => !isNaN(y));
      const latestYear = Math.max(...allYears);
      const last10 = Array.from({ length: 10 }, (_, i) => (latestYear - i).toString());
      console.log('Latest year in rainfall data:', latestYear, 'Using last 10 years:', last10);

      // Aggregate rainfall by state
      const stateRain = {};
      rainRows.forEach(r => {
        const subdivision = (r[0] || '').toLowerCase();
        const year = r[yearIndex];
        if (!year || !last10.includes(year)) return;

        const annualVal = parseFloat(r[annualIndex]);
        if (isNaN(annualVal)) return;

        for (let s of states) {
          const substrings = stateMapSubstrings[s] || [s.toLowerCase()];
          for (let sub of substrings) {
            if (subdivision.includes(sub)) {
              if (!stateRain[s]) stateRain[s] = [];
              stateRain[s].push(annualVal);
              break;
            }
          }
        }
      });

      // Build result
      let result = `🌧️ Rainfall comparison (average of last 10 years, ${latestYear - 9} to ${latestYear}):\n`;
      for (let s of states) {
        if (stateRain[s] && stateRain[s].length > 0) {
          const avg = (stateRain[s].reduce((a, b) => a + b, 0) / stateRain[s].length).toFixed(2);
          result += `${s}: ${avg} mm (based on ${stateRain[s].length} records)\n`;
        } else {
          result += `${s}: No data available (no matching subdivisions found for last 10 years)\n`;
        }
      }

      ans.innerHTML = result;
      console.log('Rainfall data used:', stateRain);
      return;
    }

    // ---------------------------------
    // 🌾 TOP CROPS LOGIC
    // ---------------------------------
    if (q.includes('top') && q.includes('crop')) {
      const yearMatch = q.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;
      const candidateStates = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Punjab', 'Gujarat'];
      const state = candidateStates.find(s => q.includes(s.toLowerCase()));

      if (!state) {
        ans.innerHTML = '⚠️ Please mention a valid state (e.g., Tamil Nadu, Maharashtra).';
        return;
      }

      if (!year) {
        ans.innerHTML = '⚠️ Please include a valid year (e.g., 2000).';
        return;
      }

      // Find relevant columns
      const stateIdx = cropHeader.findIndex(h => /state/i.test(h));
      const yearIdx = cropHeader.findIndex(h => /crop[_ ]?year/i.test(h) || /year/i.test(h));
      const cropIdx = cropHeader.findIndex(h => /crop/i.test(h));
      const prodIdx = cropHeader.findIndex(h => /production/i.test(h));

      const filtered = cropRows.filter(r =>
        r[stateIdx] &&
        r[stateIdx].toLowerCase().includes(state.toLowerCase()) &&
        parseInt(r[yearIdx]) === year
      );

      console.log('Filtered crops count:', filtered.length, 'for', state, year);

      if (filtered.length === 0) {
        ans.innerHTML = `❌ No crop data found for ${state} in ${year}. Try year 2000–2003.`;
        return;
      }

      // Sort by production descending
      filtered.sort((a, b) => parseFloat(b[prodIdx] || 0) - parseFloat(a[prodIdx] || 0));

      const top3 = filtered.slice(0, 3)
        .map(r => `${r[cropIdx]} – ${r[prodIdx]} tonnes`)
        .join('\n');

      ans.innerHTML = `🌾 Top crops in ${state} (${year}):\n${top3}`;
      return;
    }

    // ---------------------------------
    // Default Fallback
    // ---------------------------------
    ans.innerHTML = 'Sorry, I can only compare rainfall or list top crops for now.';
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('answer').innerHTML = '⚠️ Error: ' + err.message;
  }
}
