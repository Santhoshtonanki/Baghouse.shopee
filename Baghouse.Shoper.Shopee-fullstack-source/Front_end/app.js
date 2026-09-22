const API = '/api';
let cart = JSON.parse(localStorage.getItem('baghouse_cart') || '[]');
let token = localStorage.getItem('baghouse_token') || '';

const categoryNames = [
  ['luggage','🧳','Luggage / Travel'],
  ['backpacks','🎒','Backpacks'],
  ['school-bags','🎒','School Bags'],
  ['laptop-bags','💻','Laptop Bags'],
  ['office-bags','💼','Office Bags'],
  ['wallets','👛','Premium Wallets'],
  ['belts','👔','Leather Belts'],
  ['umbrellas','☂️','Umbrellas'],
  ['bottles','🥤','Bottles'],
  ['key-chains','🔑','Key Chains'],
  ['comic-idols','🦸','Comic / Character Idols'],
  ['rucksack','🏕️','Rucksack Bags']
];

function $(id){ return document.getElementById(id); }

function updateCartCount(){
  $('cartCount').textContent = cart.reduce((sum,x)=>sum+x.quantity,0);
  localStorage.setItem('baghouse_cart', JSON.stringify(cart));
}

async function api(path, options={}){
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if(token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API+path, {...options,headers});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

function renderCategories(){
  $('categoryGrid').innerHTML = categoryNames.map(([slug,icon,name])=>
    `<button data-category="${slug}"><div style="font-size:28px">${icon}</div>${name}</button>`
  ).join('');
  document.querySelectorAll('[data-category]').forEach(b=>{
    b.onclick=()=>loadProducts(`?category=${encodeURIComponent(b.dataset.category)}`);
  });
}

async function loadProducts(query=''){
  const products = await api('/products'+query);
  $('productsGrid').innerHTML = products.length ? products.map(p=>`
    <article class="product">
      <img src="${p.image_url || 'https://placehold.co/700x500?text=Baghouse'}" alt="${p.name}">
      <div class="product-body">
        <div class="brand">${p.brand_name || 'Baghouse'}</div>
        <h3>${p.name}</h3>
        <div><span class="price">₹${Number(p.price).toLocaleString('en-IN')}</span><span class="mrp">₹${Number(p.mrp).toLocaleString('en-IN')}</span></div>
        <div class="rating">★ 4.5 · In stock: ${p.stock}</div>
        <button class="add" data-add="${p.id}">Add to Cart</button>
      </div>
    </article>`).join('') : '<p>No products found.</p>';

  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addToCart(Number(b.dataset.add)));
}

async function addToCart(id){
  const product = await api('/products/'+id);
  const found = cart.find(x=>x.product_id===id);
  if(found) found.quantity++;
  else cart.push({product_id:id, name:product.name, price:Number(product.price), quantity:1, image_url:product.image_url});
  updateCartCount();
  alert(`${product.name} added to cart`);
}

function openModal(html){ $('modalContent').innerHTML=html; $('modal').classList.remove('hidden'); }
function closeModal(){ $('modal').classList.add('hidden'); }

function loginModal(){
  openModal(`
    <h2>Login / Register</h2>
    <input id="authName" placeholder="Name (only for registration)">
    <input id="authEmail" type="email" placeholder="Email">
    <input id="authPassword" type="password" placeholder="Password">
    <input id="authPhone" placeholder="Phone (optional)">
    <button class="submit" id="doLogin">Login</button>
    <p style="font-size:13px;color:#65758b">New customer? The same form can create an account.</p>
    <button class="submit" id="doRegister">Create Account</button>
  `);
  $('doLogin').onclick=async()=>{
    try{
      const data=await api('/auth/login',{method:'POST',body:JSON.stringify({
        email:$('authEmail').value,password:$('authPassword').value
      })});
      token=data.token;localStorage.setItem('baghouse_token',token);closeModal();alert('Login successful');
    }catch(e){alert(e.message)}
  };
  $('doRegister').onclick=async()=>{
    try{
      const data=await api('/auth/register',{method:'POST',body:JSON.stringify({
        name:$('authName').value,email:$('authEmail').value,password:$('authPassword').value,phone:$('authPhone').value
      })});
      token=data.token;localStorage.setItem('baghouse_token',token);closeModal();alert('Account created');
    }catch(e){alert(e.message)}
  };
}

function cartModal(){
  const total=cart.reduce((s,x)=>s+x.price*x.quantity,0);
  openModal(`
    <h2>Your Cart</h2>
    ${cart.length ? cart.map((x,i)=>`
      <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid #eee;padding:10px 0">
        <img src="${x.image_url}" style="width:60px;height:50px;object-fit:cover;border-radius:6px">
        <div style="flex:1"><b>${x.name}</b><br>₹${x.price} × ${x.quantity}</div>
        <button onclick="removeCart(${i})">Remove</button>
      </div>`).join('') : '<p>Your cart is empty.</p>'}
    <h3>Total: ₹${total.toLocaleString('en-IN')}</h3>
    ${cart.length ? `<textarea id="shipAddress" placeholder="Shipping address"></textarea>
      <button class="submit" id="checkout">Place COD Order</button>` : ''}
  `);
  if(cart.length) $('checkout').onclick=checkout;
}
window.removeCart=(i)=>{cart.splice(i,1);updateCartCount();cartModal()};

async function checkout(){
  if(!token){closeModal();loginModal();return;}
  try{
    const data=await api('/orders',{method:'POST',body:JSON.stringify({
      items:cart.map(x=>({product_id:x.product_id,quantity:x.quantity})),
      shipping_address:$('shipAddress').value,
      payment_method:'COD'
    })});
    cart=[];updateCartCount();closeModal();
    alert(`Order #${data.order_id} placed successfully`);
    loadProducts();
  }catch(e){alert(e.message)}
}

async function ordersModal(){
  if(!token){loginModal();return}
  try{
    const orders=await api('/orders/my');
    openModal(`<h2>My Orders</h2>${orders.length?orders.map(o=>`
      <div style="border:1px solid #e5e7eb;padding:12px;margin:10px 0;border-radius:8px">
        <b>Order #${o.id}</b> · ${o.status}<br>
        Total: ₹${Number(o.total_amount).toLocaleString('en-IN')}<br>
        <small>${new Date(o.created_at).toLocaleString()}</small>
      </div>`).join(''):'<p>No orders yet.</p>'}`);
  }catch(e){alert(e.message)}
}

async function serviceModal(){
  if(!token){loginModal();return}
  openModal(`
    <h2>Product Service & Repair</h2>
    <input id="serviceOrder" placeholder="Order ID (optional)">
    <input id="serviceProduct" placeholder="Product ID (optional)">
    <input id="serviceType" placeholder="Service type e.g. Repair / Warranty">
    <textarea id="serviceIssue" placeholder="Describe the issue"></textarea>
    <button class="submit" id="sendService">Raise Request</button>
  `);
  $('sendService').onclick=async()=>{
    try{
      const data=await api('/service-requests',{method:'POST',body:JSON.stringify({
        order_id:$('serviceOrder').value||null,
        product_id:$('serviceProduct').value||null,
        service_type:$('serviceType').value,
        issue_description:$('serviceIssue').value
      })});
      closeModal();alert(`Service request #${data.id} created`);
    }catch(e){alert(e.message)}
  };
}

$('searchForm').onsubmit=e=>{
  e.preventDefault();
  const q=$('searchInput').value.trim();
  loadProducts(q?`?search=${encodeURIComponent(q)}`:'');
  location.hash='products';
};
$('loginBtn').onclick=loginModal;
$('cartBtn').onclick=cartModal;
$('ordersBtn').onclick=ordersModal;
$('serviceBtn').onclick=serviceModal;
$('closeModal').onclick=closeModal;
$('clearFilters').onclick=()=>loadProducts();
document.querySelectorAll('[data-brand]').forEach(b=>{
  b.onclick=()=>loadProducts(`?brand=${encodeURIComponent(b.dataset.brand)}`);
});

renderCategories();
updateCartCount();
loadProducts().catch(e=>{
  $('productsGrid').innerHTML=`<p>Backend connection error: ${e.message}. Start MySQL and the Node.js server.</p>`;
});
