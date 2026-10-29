import {useState} from "react";
import {Text,TextInput,Pressable,View} from "react-native";
import {router} from "expo-router";
import {Screen} from "../components/ui";
import {FluenttLogo} from "../components/FluenttLogo";
import {useSession} from "../session/provider";
import {destination} from "../session/routing";
import {a} from "../features/auth/styles";
export default function SetPassword(){
 const session=useSession();const [password,setPassword]=useState("");const [confirmation,setConfirmation]=useState("");const [visible,setVisible]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(){if(busy)return;setError("");if(Array.from(password).length<6||Array.from(password).length>128){setError("Choose a password with 6–128 characters.");return;}if(password!==confirmation){setError("Your passwords do not match.");return;}setBusy(true);try{const profile=await session.setPassword(password);setPassword("");setConfirmation("");router.replace(destination(profile));}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
 return <Screen style={a.safe} backDisabled={busy}><FluenttLogo size={32}/><Text accessibilityRole="header" style={a.title}>Keep your account.</Text><Text style={a.description}>Add a password so you can sign in again. Your learning stays with you.</Text><View style={a.card}><Text style={a.label}>New password</Text><TextInput accessibilityLabel="New password" style={a.input} value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" secureTextEntry={!visible} editable={!busy}/><Text style={a.label}>Confirm password</Text><TextInput accessibilityLabel="Confirm password" style={a.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" secureTextEntry={!visible} editable={!busy} onSubmitEditing={()=>void submit()}/><Pressable accessibilityRole="button" onPress={()=>setVisible(v=>!v)} style={a.show}><Text style={a.showText}>{visible?"Hide passwords":"Show passwords"}</Text></Pressable>{!!error&&<Text accessibilityRole="alert" style={a.error}>{error}</Text>}<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} style={a.submit}><Text style={a.submitText}>{busy?"Saving…":"Save password"}</Text></Pressable></View></Screen>;
}
