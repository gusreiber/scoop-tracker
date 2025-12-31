

document.addEventListener('DOMContentLoaded', async ()=>{
  // Safe to query and manipulate DOM elements
  
  const api = new ScoopAPI({
    nonce: SCOOP.nonce,
    base: "/", // optional
    routes: {
      planning: SCOOP.restUrl, // /wp-json/scoop/v1/planning
    }
  });

  const batchs = new Grid(document.getElementById('wpbody-content'), 'batchs', 
    {api:api, formCodec:FormCodec, domainCodec:DomainCodec});
  const grid = new Grid(document.getElementById('wpbody-content'), 'planning', 
    {api:api, formCodec:FormCodec, domainCodec:DomainCodec});
  const tub = new Grid(document.getElementById('wpbody-content'), 'tubs' );

  const raw = await api.loadBundle({
    cabinets:  { url: "/wp-json/wp/v2/cabinet?_fields=id,slots,location,title", paged: true },
    flavors:   { url: "/wp-json/wp/v2/flavor?_fields=id,title,tubs", paged: true },
    slots:     { url: "/wp-json/wp/v2/slot?_fields=id,title,current_flavor,immediate_flavor,next_flavor,location,cabinet", paged: true },
    locations: { url: "/wp-json/wp/v2/location?_fields=id,title", paged: true },
    tubs:      { url: "/wp-json/wp/v2/tub?_fields=id,title,flavor,location,state,index,date", paged: true },
  });

  const D   = DomainCodec.decode(raw);
  const CGM = new CabinetGridModel(D);
  const FTM = new FlavorTubsGridModel(D);
  const BGM = new BatchGridModel(D);

  batchs.init(BGM);
  grid.init(CGM);
  tub.init(FTM);

});