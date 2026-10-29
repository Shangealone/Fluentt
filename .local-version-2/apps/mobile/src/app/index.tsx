import {router} from "expo-router";
import {WelcomeScreen} from "../features/welcome/WelcomeScreen";
export default function Welcome(){return <WelcomeScreen onPersonal={()=>router.push("/auth?mode=create&role=personal_student")} onClassroom={()=>router.push("/auth?mode=create&role=school_student")} onSignIn={()=>router.push("/auth?mode=signin")}/>;}
