import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, query, where, setDoc, updateDoc, arrayUnion} from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [kidEmail, setKidEmail] = useState('');
  const [isKid, setIsKid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isKid === null) {
      setError('Please select if you are a kid or not');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let kidAccountId = null; 

      // Create Stripe customer
      const res = await fetch("http://localhost:3000/create_customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, metadata: { firebaseUid: user.uid } }),
      });
      const { customer } = await res.json();


      // Create connected account for kid 
      if (!isKid && kidEmail) {
        const connection = await fetch("http://localhost:3000/create_connected", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kidEmail }),
        });
        
        const data = await connection.json();
        console.log("Data: ", data)
        console.log("data account id: ", data.account.id)
        // set not only the kid's email but the destination id
        kidAccountId = data.account.id

        // Add the kid as a friend 
        // Search for users with this email "kidEmail"
        // then save this friend id
        // Below add this id to our friends list (bidirectional)
        const usersQuery = await getDocs(
            query(collection(db, "users"), where("email", "==", kidEmail))
        );

        let kidUserId: string | null = null;

        usersQuery.forEach((docSnap) => {
            kidUserId = docSnap.id; // get the Firestore document ID
        });

        await setDoc(doc(db, "users", user.uid), {
            kidEmail: kidEmail || null,
            kidAccountId: kidAccountId, 
            customerId: customer.id, 
            email,
            name: name.trim(),
            isKid,
            balance: 0,
            createdImages: [],
            ownedImages: [],
            fridge: [],
            receivedImages: [],
            friends: [],
            createdAt: Date.now()
        });

        if (kidUserId) {
            // add friends both ways
            const currentUserRef = doc(db, "users", user.uid);
            await updateDoc(currentUserRef, {
                friends: arrayUnion(kidUserId),
            });

            const kidUserRef = doc(db, "users", kidUserId);
            await updateDoc(kidUserRef, {
                friends: arrayUnion(user.uid),
            });

            console.log(`Added kid as a friend with ID: ${kidUserId}`);
        } else {
            console.log(`No user found with email: ${kidEmail}`);
        }
      } else {
        await setDoc(doc(db, "users", user.uid), {
              kidEmail: kidEmail || null,
              kidAccountId: kidAccountId, 
              customerId: customer.id, 
              email,
              name: name.trim(),
              isKid,
              balance: 0,
              createdImages: [],
              ownedImages: [],
              fridge: [],
              receivedImages: [],
              friends: [],
              createdAt: Date.now()
          });
      }

      if(!isKid){ 
        navigate('/loadCard', { state: { customerId: customer.id } });
      } else {
        navigate('/fridge')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '50px auto', padding: 24, border: '2px solid #ddd', borderRadius: 12, backgroundColor: '#f9f9f9' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24, color: 'black'}}>🎨 Sign Up</h2>

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' }}>Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
          />
        </div>

        {/* Are you a kid? */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' }}>Are you a kid?</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setIsKid(true)}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: isKid === true ? '#4CAF50' : 'white',
                color: isKid === true ? 'white' : '#333',
                border: '2px solid #4CAF50',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setIsKid(false)}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: isKid === false ? '#4CAF50' : 'white',
                color: isKid === false ? 'white' : '#333',
                border: '2px solid #4CAF50',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              No
            </button>
          </div>
        </div>

        {/* Kid Email (conditional) */}
        {!isKid && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="kidEmail" style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#333' }}>
              Enter Kid's Email
            </label>
            <input
              id="kidEmail"
              type="email"
              value={kidEmail}
              onChange={(e) => setKidEmail(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#fee', color: '#c33', borderRadius: 6, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 'bold',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      {/* Login link */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: 14 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'none', fontWeight: 'bold' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
