async function testCommons() {
  const query = "laptop";
  
  // Try filetype:bitmap|video
  const url5 = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap|video')}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
  
  const res = await fetch(url5);
  const data = await res.json();
  console.log("combined:", data.query ? Object.values(data.query.pages).length : 0);
  if (data.query && data.query.pages) {
    Object.values(data.query.pages).forEach(p => console.log(p.title, p.imageinfo[0].mime));
  }
}

testCommons();
