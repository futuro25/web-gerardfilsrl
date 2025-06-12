import {ClipLoader} from 'react-spinners'

export default function LoadingState (){
  return (
    <div className="flex w-full h-screen items-center justify-center">
      <ClipLoader />
    </div>
  )
}