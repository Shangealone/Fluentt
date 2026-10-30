import { useRef, useState, type ComponentRef } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { FluenttLogo } from "../components/FluenttLogo";
import { useSession } from "../session/provider";
import { destination, usernameError } from "../session/routing";
import {a} from "../features/auth/styles";
import { ApiError, type Role } from "../services/api/identity";
import type { ClassPreview } from "../services/api/enrollment";

const roles = [
  {value:"personal_student",label:"Personal learner",hint:"Learn at your own pace.",image:require("../../assets/illustrations/activity-learn.png"),color:"#E7F1CF"},
  {value:"school_student",label:"Student",hint:"Join your class.",image:require("../../assets/illustrations/account-student.png"),color:"#EDE8FB"},
  {value:"instructor",label:"Teacher",hint:"Guide your learners.",image:require("../../assets/illustrations/account-teacher.png"),color:"#E2F2F8"},
] as const;
export default function Auth() {
  const params=useLocalSearchParams<{mode?:string;role?:string}>();
  const session=useSession();
  const [mode,setMode]=useState(params.mode==="create"?"create":"signin");
  const [role,setRole]=useState<Role>(roles.find(r=>r.value===params.role)?.value??"personal_student");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [classCode,setClassCode]=useState("");
  const [classPreview,setClassPreview]=useState<ClassPreview|null>(null);
  const [visible,setVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [previewBusy,setPreviewBusy]=useState(false);
  const [error,setError]=useState("");
  const passwordRef=useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef=useRef<ComponentRef<typeof TextInput>>(null);
  const creating=mode==="create";
  const locked=busy||session.pending||previewBusy;
  const showCreateFields=!creating||role!=="school_student"||classPreview!==null||session.pending;
  const submitDisabled=busy||previewBusy||(creating&&role==="school_student"&&!session.pending&&!classPreview);
  async function verifyClassCode(){
    if(previewBusy)return;
    setError("");
    if(!/^[0-9]{6}$/.test(classCode)){setError("Enter the six-digit code from your teacher.");return;}
    setPreviewBusy(true);
    try{setClassPreview(await session.registrationPreview(classCode));}
    catch(e){setClassPreview(null);setError(e instanceof Error?e.message:"We could not check that class code. Please try again.");}
    finally{setPreviewBusy(false);}
  }
  async function submit() {
    if(busy||previewBusy)return;
    setError("");
    if(!session.pending){
      if(creating&&role==="school_student"&&!classPreview){setError("Check your class code before creating your account.");return;}
      const invalid=creating?usernameError(username):!username.trim()?"Enter your username.":null;
      if(invalid){setError(invalid);return;}
      if(Array.from(password).length<(creating?6:1)||Array.from(password).length>128){setError(creating?"Choose a password with 6–128 characters.":"Enter your password.");return;}
      if(creating&&password!==confirmation){setError("Your passwords do not match.");return;}
    }
    setBusy(true);
    try{
      const classDetails=creating&&role==="school_student"&&classPreview?{code:classCode,class_version:classPreview.class_version}:undefined;
      const profile=creating?await session.create(username,role,password,classDetails):await session.login(username.trim(),password);
      setPassword("");setConfirmation("");
      router.replace(destination(profile));
    }catch(e){
      if(e instanceof ApiError&&(e.status===404||e.message==="Class details changed. Verify the code and review again."))setClassPreview(null);
      const message=e instanceof Error?e.message:"We could not sign you in. Please try again.";
      const uncertain=creating && (e as {status?:number}|null)?.status===0 && !message.includes("did not keep the sign-in cookie");
      setError(uncertain?message+" Your account may already be saved. Try signing in before creating it again.":message);
    }
    finally{setBusy(false);}
  }
  return <SafeAreaView style={a.safe}>
    <KeyboardAvoidingView style={a.flex} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={a.content}>
        <View style={a.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to welcome" disabled={locked} onPress={()=>router.replace("/")} style={a.back}><Text style={a.backText}>‹</Text></Pressable>
          <FluenttLogo size={32}/>
        </View>
        <View style={a.intro}>
          <View style={a.art}><Image accessible={false} source={require("../../assets/illustrations/account-welcome.png")} style={a.heroImage}/></View>
          <Text accessibilityRole="header" style={a.title}>{creating?"Your next chapter starts here.":"Welcome back."}</Text>
          <Text style={a.description}>{creating?"A little practice. A little more confidence.":"Let’s keep learning, one step at a time."}</Text>
        </View>
        <View style={a.card}>
          <View accessibilityRole="tablist" style={a.tabs}>
            {[["signin","Sign in"],["create","Create account"]].map(([value,label])=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:mode===value,disabled:locked}} disabled={locked} onPress={()=>{setMode(value);setError("");setPassword("");setConfirmation("");setVisible(false);}} style={[a.tab,mode===value&&a.selectedTab]}><Text style={[a.tabText,mode===value&&a.selectedTabText]}>{label}</Text></Pressable>)}
          </View>
          {creating&&<View style={a.field}><Text style={a.label}>I’m a…</Text><View accessibilityRole="radiogroup" accessibilityLabel="Account type" style={a.roles}>{roles.map(r=><Pressable key={r.value} accessibilityRole="radio" accessibilityLabel={r.label} accessibilityState={{checked:role===r.value,disabled:locked}} disabled={locked} onPress={()=>{if(role!==r.value){setRole(r.value);setClassCode("");setClassPreview(null);setError("");}}} style={[a.role,role===r.value&&a.selectedRole]}>
            <View style={[a.roleIcon,{backgroundColor:r.color}]}><Image accessible={false} source={r.image} style={a.roleImage}/></View>
            <View style={a.roleCopy}><Text style={a.roleTitle}>{r.label}</Text><Text style={a.hint}>{r.hint}</Text></View><Text accessible={false} style={a.radio}>{role===r.value?"●":"○"}</Text>
          </Pressable>)}</View></View>}
          {creating&&role==="school_student"&&<View style={a.field}>
            <Text style={a.label}>Your class code</Text>
            <Text style={a.hint}>Enter the six-digit code from your teacher. We’ll show the class before creating your account.</Text>
            <TextInput accessibilityLabel="Six-digit class code" style={a.input} value={classCode} onChangeText={value=>{setClassCode(value.replace(/[^0-9]/g,"").slice(0,6));setClassPreview(null);setError("");}} editable={!locked} keyboardType="number-pad" inputMode="numeric" autoCorrect={false} maxLength={6} returnKeyType="done" placeholder="000000" placeholderTextColor="#7B887F"/>
            <Pressable accessibilityRole="button" accessibilityLabel="Check class code" accessibilityState={{disabled:locked||!/^[0-9]{6}$/.test(classCode),busy:previewBusy}} disabled={locked||!/^[0-9]{6}$/.test(classCode)} onPress={()=>void verifyClassCode()} style={[a.codeAction,(locked||!/^[0-9]{6}$/.test(classCode))&&a.dim]}><Text style={a.codeActionText}>{previewBusy?"Checking class…":classPreview?"Check code again":"Check class code"}</Text></Pressable>
            {classPreview&&<View style={a.classPreview}><Text style={a.previewHeading}>{classPreview.class_name}</Text>{classPreview.instructor_display_name&&<Text style={a.hint}>Teacher: {classPreview.instructor_display_name}</Text>}<Text style={a.hint}>Grade {classPreview.grade_level} · {classPreview.language==="english"?"English":"Tagalog"}</Text><Text style={a.previewNote}>You’ll join this class when your account is created.</Text></View>}
          </View>}
          {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={a.error}>{error}</Text>}
          {showCreateFields&&<>
          <View style={a.field}>
            <Text style={a.label} nativeID="username-label">Username</Text>
            <TextInput accessibilityLabel="Username" accessibilityLabelledBy="username-label" style={a.input} value={username} onChangeText={setUsername} editable={!locked} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" maxLength={creating?24:128} returnKeyType="next" onSubmitEditing={()=>passwordRef.current?.focus()} placeholder="Your username" placeholderTextColor="#7B887F"/>
            {creating&&<Text style={a.hint}>3–24 letters, numbers, underscores or spaces between words.</Text>}
          </View>
          <View style={a.field}>
            <Text style={a.label}>{creating ? "Password (6 or more characters)" : "Password"}</Text>
            <View style={a.passwordRow}><TextInput ref={passwordRef} accessibilityLabel="Password" style={[a.input,a.password]} value={password} onChangeText={setPassword} editable={!locked} autoCapitalize="none" autoCorrect={false} autoComplete={creating?"new-password":"current-password"} textContentType={creating?"newPassword":"password"} secureTextEntry={!visible} maxLength={128} returnKeyType={creating?"next":"go"} onSubmitEditing={()=>creating?confirmRef.current?.focus():void submit()} placeholder={creating?"At least 6 characters":"Your password"} placeholderTextColor="#7B887F"/>
              <Pressable accessibilityRole="button" accessibilityLabel={visible?"Hide passwords":"Show passwords"} accessibilityState={{checked:visible}} onPress={()=>setVisible(v=>!v)} style={a.show}><Text style={a.showText}>{visible?"Hide":"Show"}</Text></Pressable></View>
          </View>
          {creating&&<View style={a.field}><Text style={a.label}>Confirm password</Text><TextInput ref={confirmRef} accessibilityLabel="Confirm password" style={a.input} value={confirmation} onChangeText={setConfirmation} editable={!locked} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" secureTextEntry={!visible} maxLength={128} returnKeyType="go" onSubmitEditing={()=>void submit()} placeholder="Enter it again" placeholderTextColor="#7B887F"/></View>}
          {session.pending&&<Text style={a.hint}>Your account is ready. Tap below to finish saving sign-in on this device.</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{disabled:submitDisabled,busy}} disabled={submitDisabled} onPress={()=>void submit()} style={[a.submit,submitDisabled&&a.dim]}><Text style={a.submitText}>{busy?"Please wait…":session.pending?"Finish sign-in":creating?"Create account":"Sign in"}</Text></Pressable>
          </>}
        </View>
        <Text style={a.footer}>Small steps. More confidence.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
