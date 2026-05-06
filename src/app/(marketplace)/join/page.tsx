"use client"

import { useState } from "react"

const TRUCK_TYPES = [
  "All aggregate hauling trucks",
  "Tandem Axle", "Tri-Axle", "Quad Axle", "End Dump",
  "Belly Dump", "Side Dump", "Super Dump", "Transfer Truck",
  "Semi / 18-Wheeler", "Pup Trailer", "Water Truck", "Flatbed",
]

const EQUIPMENT_TYPES = [
  "Excavator", "Skid Steer", "Backhoe", "Dozer / Bulldozer",
  "Wheel Loader", "Motor Grader", "Compactor / Roller",
  "Articulated Hauler", "Track Loader", "Mini Excavator",
  "Trencher", "Scraper", "Telehandler", "Crane",
]

const DRIVER_AVAILABILITY = [
  { id: "fulltime", label: "Full-Time", desc: "Available daily for scheduled loads" },
  { id: "parttime", label: "Part-Time", desc: "A few days a week or specific hours" },
  { id: "backhaul", label: "Backhaul / On the Way Home", desc: "Pick up loads on your route home — never drive empty" },
  { id: "on_call", label: "Pick Up Loads Here & There", desc: "Grab loads when it works for your schedule" },
]

const CONTRACTOR_AVAILABILITY = [
  { id: "fulltime", label: "Full-Time", desc: "Available for ongoing projects" },
  { id: "parttime", label: "Part-Time", desc: "A few days a week or between jobs" },
  { id: "cancellations", label: "Fill Cancellations", desc: "Jump in when other crews fall through" },
  { id: "on_call", label: "Here & There", desc: "Take work when your schedule allows" },
]

const CITIES = [
  "Denver, CO", "Dallas-Fort Worth, TX", "Houston, TX", "Austin, TX",
  "Phoenix, AZ", "Las Vegas, NV", "Atlanta, GA", "Orlando, FL",
  "Tampa, FL", "Charlotte, NC", "Other",
]

type AvailabilityOption = { id: string; label: string; desc: string }

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#059669" opacity="0.1" />
    <path d="M6 10l3 3 5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const TruckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

const HardHatIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18h20" /><path d="M4 18v-3a8 8 0 0 1 16 0v3" />
    <path d="M12 2v5" /><path d="M8 7h8" />
  </svg>
)

const DollarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

function TrustBar() {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center",
      padding: "12px 0", opacity: 0.7, fontSize: "12px", color: "#6b7280",
      letterSpacing: "0.02em", fontWeight: 500,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <ShieldIcon /> 256-bit Encrypted
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <ShieldIcon /> Your data is never sold
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <ShieldIcon /> SOC 2 Compliant Infrastructure
      </span>
    </div>
  )
}

function Input({ label, style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{label}</label>
      <input
        {...props}
        style={{
          width: "100%", padding: "12px 16px", fontSize: "14px",
          border: "1px solid #d1d5db", borderRadius: "12px", outline: "none",
          background: "#fff", color: "#111827", transition: "all 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          ...style,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#059669"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.1)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)" }}
      />
    </div>
  )
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{label}</label>
      <select {...props} style={{
        width: "100%", padding: "12px 16px", fontSize: "14px",
        border: "1px solid #d1d5db", borderRadius: "12px", outline: "none",
        background: "#fff", color: "#111827", cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}>
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

/** Chip-grid multi-select. Click to toggle each value. */
function MultiSelectChips({ label, options, selected, onToggle, helper }: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  helper?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{label}</label>
      {helper && <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "-2px" }}>{helper}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {options.map(opt => {
          const isSelected = selected.includes(opt)
          return (
            <button key={opt} type="button" onClick={() => onToggle(opt)} style={{
              padding: "10px 14px", borderRadius: "10px",
              border: isSelected ? "2px solid #059669" : "1px solid #e5e7eb",
              background: isSelected ? "#f0fdf4" : "#fff",
              color: isSelected ? "#059669" : "#374151",
              fontSize: "13px", fontWeight: isSelected ? 600 : 500,
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: isSelected ? "0 0 0 3px rgba(5,150,105,0.08)" : "none",
            }}>
              {isSelected ? "✓ " : ""}{opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CheckboxGroup({ label, options, selected, onToggle }: {
  label: string; options: AvailabilityOption[]; selected: string[]; onToggle: (id: string) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {options.map(opt => {
          const isSelected = selected.includes(opt.id)
          return (
            <button key={opt.id} onClick={() => onToggle(opt.id)} type="button" style={{
              padding: "14px 16px", borderRadius: "12px", textAlign: "left",
              border: isSelected ? "2px solid #059669" : "1px solid #e5e7eb",
              background: isSelected ? "#f0fdf4" : "#fff",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: isSelected ? "0 0 0 3px rgba(5,150,105,0.08)" : "none",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: isSelected ? "#059669" : "#374151" }}>
                {opt.label}
              </div>
              <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", lineHeight: 1.3 }}>
                {opt.desc}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SuccessCard({ role }: { role: "driver" | "contractor" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      padding: "24px 8px", gap: "16px",
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px solid #bbf7d0",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
      <h3 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
        You&rsquo;re on the list.
      </h3>
      <p style={{ fontSize: "15px", color: "#374151", lineHeight: 1.55, margin: 0, maxWidth: "440px" }}>
        Thanks for joining the EarthMove network. <b>We&rsquo;ll be in touch soon</b> with next
        steps for getting you {role === "driver" ? "set up to haul" : "matched to projects"}.
      </p>
      <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, maxWidth: "420px", lineHeight: 1.5 }}>
        Questions in the meantime? Reach out to{" "}
        <a href="mailto:support@filldirtnearme.net" style={{ color: "#059669", fontWeight: 600 }}>
          support@filldirtnearme.net
        </a>.
      </p>
    </div>
  )
}

interface SubmitResult {
  state: "idle" | "submitting" | "success" | "error"
  message?: string
}

const submitButtonStyle: React.CSSProperties = {
  width: "100%", padding: "16px", background: "#059669", color: "#fff",
  fontSize: "15px", fontWeight: 700, borderRadius: "14px", border: "none",
  cursor: "pointer", boxShadow: "0 8px 24px rgba(5,150,105,0.25)",
  transition: "all 0.2s", letterSpacing: "0.01em",
}

function DriverForm() {
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [primaryLocation, setPrimaryLocation] = useState("")
  const [yearsInBusiness, setYearsInBusiness] = useState("")
  const [truckTypes, setTruckTypes] = useState<string[]>([])
  const [count, setCount] = useState("")
  const [availability, setAvailability] = useState<string[]>([])
  const [result, setResult] = useState<SubmitResult>({ state: "idle" })

  const toggleAvailability = (id: string) => setAvailability(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleTruck = (t: string) => setTruckTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (result.state === "submitting") return
    setResult({ state: "submitting" })
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "driver",
          fullName, companyName: companyName || undefined,
          email, phone,
          primaryLocation: primaryLocation || undefined,
          yearsInBusiness: yearsInBusiness === "" ? undefined : yearsInBusiness,
          primaryTypes: truckTypes,
          count: count === "" ? undefined : count,
          availability,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) {
        setResult({ state: "success" })
      } else {
        setResult({ state: "error", message: j.error || "Something went wrong. Please try again." })
      }
    } catch {
      setResult({ state: "error", message: "Network error. Please try again." })
    }
  }

  if (result.state === "success") return <SuccessCard role="driver" />

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #bbf7d0", borderRadius: "16px", padding: "20px",
        display: "flex", gap: "14px", alignItems: "flex-start",
      }}>
        <DollarIcon />
        <div>
          <div style={{ fontWeight: 700, color: "#059669", fontSize: "15px" }}>Same-Day Payment</div>
          <div style={{ fontSize: "13px", color: "#374151", marginTop: "2px", lineHeight: 1.5 }}>
            Get paid the same day you deliver. No NET 30. No chasing invoices. Haul it, deliver it, get paid.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Input label="Full Name *" placeholder="John Smith" required value={fullName} onChange={e => setFullName(e.target.value)} />
        <Input label="Company Name" placeholder="Smith Hauling LLC" value={companyName} onChange={e => setCompanyName(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Input label="Email *" type="email" placeholder="john@smithhauling.com" required value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Phone *" type="tel" placeholder="(720) 555-0100" required value={phone} onChange={e => setPhone(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Select label="Primary Location *" options={CITIES} value={primaryLocation} onChange={e => setPrimaryLocation(e.target.value)} />
        <Input label="Years in Business" type="number" placeholder="5" min="0" max="60" value={yearsInBusiness} onChange={e => setYearsInBusiness(e.target.value)} />
      </div>

      <MultiSelectChips
        label="Truck Types * (select all you operate)"
        helper={`Pick "All aggregate hauling trucks" if you can run anything we book.`}
        options={TRUCK_TYPES}
        selected={truckTypes}
        onToggle={toggleTruck}
      />

      <Input label="How Many Trucks?" type="number" placeholder="1" min="1" max="200" value={count} onChange={e => setCount(e.target.value)} />

      <CheckboxGroup label="Availability (select all that apply)" options={DRIVER_AVAILABILITY} selected={availability} onToggle={toggleAvailability} />

      <TrustBar />

      {result.state === "error" && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px",
          padding: "12px 16px", color: "#991b1b", fontSize: "13px",
        }}>
          {result.message}
        </div>
      )}

      <button type="submit" disabled={result.state === "submitting" || !fullName || !email || !phone || !primaryLocation || truckTypes.length === 0}
        style={{
          ...submitButtonStyle,
          opacity: (result.state === "submitting" || !fullName || !email || !phone || !primaryLocation || truckTypes.length === 0) ? 0.6 : 1,
          cursor: (result.state === "submitting" || !fullName || !email || !phone || !primaryLocation || truckTypes.length === 0) ? "not-allowed" : "pointer",
        }}
      >
        {result.state === "submitting" ? "Submitting..." : "Start Earning Today →"}
      </button>

      <p style={{ fontSize: "11px", color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
        By signing up you agree to our Terms of Service and Privacy Policy.
        Your information is encrypted and never shared with third parties.
      </p>
    </form>
  )
}

function ContractorForm() {
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [primaryLocation, setPrimaryLocation] = useState("")
  const [yearsInBusiness, setYearsInBusiness] = useState("")
  const [equipment, setEquipment] = useState<string[]>([])
  const [count, setCount] = useState("")
  const [availability, setAvailability] = useState<string[]>([])
  const [result, setResult] = useState<SubmitResult>({ state: "idle" })

  const toggleAvailability = (id: string) => setAvailability(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleEquipment = (t: string) => setEquipment(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (result.state === "submitting") return
    setResult({ state: "submitting" })
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "contractor",
          fullName, companyName: companyName || undefined,
          email, phone,
          primaryLocation: primaryLocation || undefined,
          yearsInBusiness: yearsInBusiness === "" ? undefined : yearsInBusiness,
          primaryTypes: equipment,
          count: count === "" ? undefined : count,
          availability,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) {
        setResult({ state: "success" })
      } else {
        setResult({ state: "error", message: j.error || "Something went wrong. Please try again." })
      }
    } catch {
      setResult({ state: "error", message: "Network error. Please try again." })
    }
  }

  if (result.state === "success") return <SuccessCard role="contractor" />

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #bbf7d0", borderRadius: "16px", padding: "20px",
        display: "flex", gap: "14px", alignItems: "flex-start",
      }}>
        <ShieldIcon />
        <div>
          <div style={{ fontWeight: 700, color: "#059669", fontSize: "15px" }}>Free Contractor Dashboard</div>
          <div style={{ fontSize: "13px", color: "#374151", marginTop: "2px", lineHeight: 1.5 }}>
            Track jobs, manage your crew, and get matched to earthwork projects in your area. Risk-free — no contracts, no obligations.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Input label="Full Name *" placeholder="Maria Garcia" required value={fullName} onChange={e => setFullName(e.target.value)} />
        <Input label="Company Name *" placeholder="Garcia Earthworks LLC" required value={companyName} onChange={e => setCompanyName(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Input label="Email *" type="email" placeholder="maria@garciaearth.com" required value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Phone *" type="tel" placeholder="(214) 555-0200" required value={phone} onChange={e => setPhone(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Select label="Primary Location *" options={CITIES} value={primaryLocation} onChange={e => setPrimaryLocation(e.target.value)} />
        <Input label="Years in Business" type="number" placeholder="10" min="0" max="60" value={yearsInBusiness} onChange={e => setYearsInBusiness(e.target.value)} />
      </div>

      <MultiSelectChips
        label="Equipment Types * (select all you operate)"
        options={EQUIPMENT_TYPES}
        selected={equipment}
        onToggle={toggleEquipment}
      />

      <Input label="How Many Pieces of Equipment?" type="number" placeholder="3" min="1" max="200" value={count} onChange={e => setCount(e.target.value)} />

      <CheckboxGroup label="Availability (select all that apply)" options={CONTRACTOR_AVAILABILITY} selected={availability} onToggle={toggleAvailability} />

      <TrustBar />

      {result.state === "error" && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px",
          padding: "12px 16px", color: "#991b1b", fontSize: "13px",
        }}>
          {result.message}
        </div>
      )}

      <button type="submit"
        disabled={result.state === "submitting" || !fullName || !companyName || !email || !phone || !primaryLocation || equipment.length === 0}
        style={{
          ...submitButtonStyle,
          opacity: (result.state === "submitting" || !fullName || !companyName || !email || !phone || !primaryLocation || equipment.length === 0) ? 0.6 : 1,
          cursor: (result.state === "submitting" || !fullName || !companyName || !email || !phone || !primaryLocation || equipment.length === 0) ? "not-allowed" : "pointer",
        }}
      >
        {result.state === "submitting" ? "Submitting..." : "Join the Network →"}
      </button>

      <p style={{ fontSize: "11px", color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
        By signing up you agree to our Terms of Service and Privacy Policy.
        Your information is encrypted and never shared with third parties.
      </p>
    </form>
  )
}

export default function JoinPage() {
  const [tab, setTab] = useState<"driver" | "contractor">("driver")

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f8fafb 0%, #f0fdf4 40%, #fff 100%)",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      padding: 0,
    }}>
      <div style={{ textAlign: "center", padding: "48px 24px 0", maxWidth: "640px", margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "100px",
          padding: "6px 16px", fontSize: "12px", fontWeight: 600, color: "#059669",
          marginBottom: "20px",
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669", animation: "pulse 2s infinite" }} />
          Now hiring across 10 cities
        </div>

        <h1 style={{
          fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, color: "#111827",
          lineHeight: 1.15, letterSpacing: "-0.025em", margin: "0 0 12px",
        }}>
          {tab === "driver" ? (
            <>Haul materials.<br />Get paid <span style={{ color: "#059669" }}>same day</span>.</>
          ) : (
            <>Grow your crew.<br />Land <span style={{ color: "#059669" }}>more projects</span>.</>
          )}
        </h1>
        <p style={{ fontSize: "16px", color: "#6b7280", lineHeight: 1.6, maxWidth: "480px", margin: "0 auto" }}>
          {tab === "driver"
            ? "Join 500+ drivers hauling aggregate materials across America's hottest construction markets. No contracts. No app downloads. Same-day pay."
            : "Connect with contractors who need earthwork pros. Get matched to projects in your area. Free dashboard to manage your equipment and crew."
          }
        </p>
      </div>

      <div style={{
        display: "flex", justifyContent: "center", gap: "32px", padding: "28px 24px 36px",
        flexWrap: "wrap",
      }}>
        {[
          { n: "500+", l: "Active Drivers" },
          { n: "10", l: "Metro Markets" },
          { n: "Same Day", l: "Payment" },
          { n: "$0", l: "To Join" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#059669" }}>{s.n}</div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px 64px" }}>
        <div style={{
          display: "flex", background: "#f3f4f6", borderRadius: "14px", padding: "4px",
          marginBottom: "24px",
        }}>
          {[
            { id: "driver" as const, label: "Driver / Hauler", icon: <TruckIcon /> },
            { id: "contractor" as const, label: "Contractor / Earthwork Pro", icon: <HardHatIcon /> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "14px 16px", borderRadius: "11px",
              background: tab === t.id ? "#fff" : "transparent",
              border: "none", cursor: "pointer",
              boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "8px",
              color: tab === t.id ? "#059669" : "#6b7280",
              fontWeight: tab === t.id ? 700 : 500, fontSize: "13px",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{
          background: "#fff", borderRadius: "20px", padding: "32px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        }}>
          {tab === "driver" ? <DriverForm /> : <ContractorForm />}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
          marginTop: "32px",
        }}>
          {(tab === "driver" ? [
            { title: "Same-Day Payment", desc: "Deliver a load, get paid that day. Period." },
            { title: "No Contracts", desc: "Work when you want. No lock-ins. No commitments." },
            { title: "Pick Up Backhaul Loads", desc: "Never drive home empty. Earn on the way back." },
            { title: "Free Driver Dashboard", desc: "Track earnings, loads, and payments in one place." },
          ] : [
            { title: "Free Dashboard", desc: "Manage equipment, crew, and projects for free." },
            { title: "Get Matched to Jobs", desc: "We connect you with projects that need your skills." },
            { title: "Risk Assessment", desc: "Know who you're working with before you start." },
            { title: "No Obligations", desc: "Join the network. Take work when it fits." },
          ]).map((b, i) => (
            <div key={i} style={{
              padding: "18px", borderRadius: "14px", background: "#fafafa",
              border: "1px solid #f3f4f6",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <CheckIcon />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{b.title}</span>
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.4 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
