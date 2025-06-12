
export default function Header ({string}){
  return (
    <div className="w-full flex sticky top-0 z-10 bg-white rounded pb-4 items-center justify-center mt-4 mb-4">
      <h1 className="inline-block font-extrabold text-slate-500 tracking-tight text-2xl">
        {string}
      </h1>
    </div>
    )
}
