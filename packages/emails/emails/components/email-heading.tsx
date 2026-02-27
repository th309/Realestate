import { Heading } from "@react-email/components";

interface EmailHeadingProps {
  children: React.ReactNode;
}

export default function EmailHeading({ children }: EmailHeadingProps) {
  return (
    <Heading className="text-xl font-bold text-gray-900 m-0 mb-4">
      {children}
    </Heading>
  );
}
