import { useEffect, useState } from "react";

const ADMIN_KEY = "mysecret123"; // same as backend

export default function Admin() {
  const [items, setItems] = useState([]);
  const BASE_URL = "https://campusshare-backend-zht7.onrender.com"; // 🔥 CHANGE THIS

  // Fetch items
  const fetchItems = async () => {
    try {
      const res = await fetch(`${BASE_URL}/admin/items?key=${ADMIN_KEY}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Delete single item
  const deleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;

    await fetch(`${BASE_URL}/admin/delete-item/${id}?key=${ADMIN_KEY}`, {
      method: "DELETE",
    });

    fetchItems(); // refresh
  };

  // Delete all items
  const deleteAll = async () => {
    if (!window.confirm("Delete ALL items?")) return;

    await fetch(`${BASE_URL}/admin/delete-all?key=${ADMIN_KEY}`, {
      method: "DELETE",
    });

    fetchItems();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Admin Panel</h1>

      <button
        onClick={deleteAll}
        style={{
          background: "red",
          color: "white",
          padding: "10px",
          marginBottom: "20px",
        }}
      >
        Delete All Items
      </button>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>User</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.title}</td>
              <td>{item.user_id}</td>
              <td>
                <button
                  onClick={() => deleteItem(item.id)}
                  style={{ background: "black", color: "white" }}
                >
                  Delete
                </button>

<button onClick={() => window.location.reload()}>
  Back
</button>              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}