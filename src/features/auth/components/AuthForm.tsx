"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { signIn, signUp } from "../actions"
import { SignInSchema, SignUpSchema } from "../schemas"
import { z } from "zod"

export function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true)
  const form = useForm({
    resolver: zodResolver(isSignIn ? SignInSchema : SignUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const toggleView = () => setIsSignIn(!isSignIn)

  const onSubmit = async (values: z.infer<typeof SignInSchema> | z.infer<typeof SignUpSchema>) => {
    if (isSignIn) {
      await signIn(values)
    } else {
      await signUp(values)
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>{isSignIn ? "Sign In" : "Create Account"}</CardTitle>
        <CardDescription>
          {isSignIn ? "Enter your credentials to access your account." : "Enter your email and password to create an account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isSignIn && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button className="w-full" type="submit">{isSignIn ? "Sign In" : "Create Account"}</Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col">
        <p className="mt-4 text-xs text-center text-gray-700">
          {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
          <span onClick={toggleView} className="text-blue-600 hover:underline cursor-pointer">
            {isSignIn ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </CardFooter>
    </Card>
  )
}
