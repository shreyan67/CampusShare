import { useEffect, useState } from "react";

export default function Admin({ goBack }) {
    const [adminKey, setAdminKey] = useState("");   
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const BASE_URL ="https://campusshare-backend-zht7.onrender.com"; // your backend

  // 🔥 Fetch items
  const fetchItems = async () => {
    try {
      setLoading(true);

    let key = adminKey;

if (!key) {
  key = prompt("Enter admin secret to access panel:");
  if (!key) return;
  setAdminKey(key);
}

      if (!key) {
        alert("Access denied ❌");
        return;
      }

      const res = await fetch(`${BASE_URL}/admin/items?key=${key}`);

      if (!res.ok) {
        throw new Error("Unauthorized or API failed");
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("ADMIN ERROR:", err);
      alert("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // 🔥 Delete item (secure)
  const deleteItem = async (id) => {
    const key = prompt("Enter admin secret key:");

    if (!key) return;

    try {
      const res = await fetch(
        `${BASE_URL}/admin/delete-item/${id}?key=${key}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      alert("Deleted successfully ✅");
      fetchItems();
    } catch (err) {
      console.error(err);
      alert("Error deleting item ❌");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Admin Panel</h1>
      <button
  onClick={async () => {
    const key = prompt("Enter admin secret key:");
    if (!key) return;

    if (!window.confirm("Delete ALL items? ⚠️")) return;

    try {
      const res = await fetch(
        `${BASE_URL}/admin/delete-all-items?key=${key}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error();

      alert("All items deleted ✅");
      fetchItems();
    } catch {
      alert("Failed ❌");
    }
  }}
  style={{
    background: "red",
    color: "white",
    padding: "8px 14px",
    marginBottom: "15px",
  }}
>
  Delete ALL Items ⚠️
</button>

      {/* 🔙 Back button */}
      <button
        onClick={goBack}
        style={{
          marginBottom: "15px",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" cellPadding="10" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>User</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {items?.length > 0 ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.owner_id}</td>
                  <td>
  {/* Delete item */}
  <button
    onClick={() => deleteItem(item.id)}
    style={{ background: "black", color: "white" }}
  >
    Delete Item
  </button>

  {/* Delete user */}
  <button
    onClick={async () => {
      const key = prompt("Enter admin secret key:");
      if (!key) return;

      if (!window.confirm("Delete this USER completely? ⚠️")) return;

      try {
        const res = await fetch(
          `${BASE_URL}/admin/delete-user/${item.owner_id}?key=${key}`,
          { method: "DELETE" }
        );

        if (!res.ok) throw new Error();

        alert("User deleted completely ✅");
        fetchItems();
      } catch {
        alert("Failed ❌");
      }
    }}
    style={{
      background: "darkred",
      color: "white",
      marginLeft: "8px",
    }}
  >
    Delete User
  </button>
</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}