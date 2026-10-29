import {Redirect,useLocalSearchParams} from "expo-router";
export default function Username(){const {role}=useLocalSearchParams<{role?:string}>();return <Redirect href={{pathname:"/auth",params:{mode:"create",role:role??"personal_student"}}}/>;}
